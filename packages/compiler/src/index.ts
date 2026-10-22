import {
  readFile,
  mkdir,
  writeFile,
  readdir,
  realpath,
  lstat,
} from 'node:fs/promises';
import { join, resolve, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  loadSpec,
  parseConfig,
  parseSource,
  confinedPath,
  readTextFile,
} from '@api-docs/spec';
import { loadGuides } from '@api-docs/content';
import { applyPlugins } from '@api-docs/plugin-sdk';
import type { BuildPlugin } from '@api-docs/plugin-sdk';
import type { SiteData, ArtifactManifest } from '@api-docs/contracts';

export const digest = (source: string | Buffer): string =>
  createHash('sha256').update(source).digest('hex');
export async function compileProject(
  root: string,
  configFile = 'docs.config.yaml',
  options: { trustPlugins?: boolean; trustContent?: boolean } = {},
): Promise<SiteData> {
  const file = await confinedPath(root, configFile);
  const config = parseConfig(
    parseSource(await readTextFile(file, 1024 * 1024), configFile),
  );
  const apis = [];
  for (const spec of config.specs) apis.push(await loadSpec(root, spec));
  for (const api of apis)
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(api.version))
      throw new Error(
        `API version must be URL-safe: ${api.version}. Set specs[].version explicitly.`,
      );
  const identities = apis.map((api) => `${api.id}:${api.version}`);
  if (new Set(identities).size !== identities.length)
    throw new Error('Duplicate API id/version after spec loading');
  let site: SiteData = {
    schemaVersion: 1,
    config,
    apis,
    guides: await loadGuides(root, config.guides, {
      trustContent: options.trustContent ?? false,
      basePath: config.basePath,
    }),
    diagnostics: apis.flatMap((api) => api.diagnostics),
  };
  if (config.plugins.length) {
    if (!options.trustPlugins)
      throw new Error(
        'Project requests executable build plugins. Review them and use --trust-plugins to opt in.',
      );
    const plugins: BuildPlugin[] = [];
    for (const path of config.plugins) {
      const imported = (await import(
        pathToFileURL(await confinedPath(root, path)).href
      )) as { default: BuildPlugin };
      plugins.push(imported.default);
    }
    site = await applyPlugins(site, plugins);
    site.pluginVersions = plugins.map(({ name, version }) => ({
      name,
      version,
    }));
  }
  return site;
}
export async function writeManifest(
  directory: string,
  site: SiteData,
  routes: string[],
): Promise<ArtifactManifest> {
  const files: Record<string, string> = {};
  const walk = async (path: string): Promise<void> => {
    for (const entry of (await readdir(path, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.name !== 'manifest.json')
        files[relative(directory, file).split(sep).join('/')] = digest(
          await readFile(file),
        );
    }
  };
  await walk(directory);
  const details: Omit<ArtifactManifest, 'artifactDigest'> = {
    schemaVersion: 1,
    compilerVersion: '0.1.0',
    inputDigest: digest(JSON.stringify(site)),
    files,
    routes,
    diagnostics: site.diagnostics,
    plugins: site.pluginVersions ?? [],
  };
  const manifest: ArtifactManifest = {
    ...details,
    artifactDigest: artifactIdentity(details),
  };
  await writeFile(
    join(directory, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );
  return manifest;
}
export function artifactIdentity(
  manifest: Omit<ArtifactManifest, 'artifactDigest'>,
): string {
  return digest(
    JSON.stringify({
      schemaVersion: manifest.schemaVersion,
      compilerVersion: manifest.compilerVersion,
      inputDigest: manifest.inputDigest,
      files: Object.fromEntries(
        Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b)),
      ),
      routes: manifest.routes,
      diagnostics: manifest.diagnostics,
      plugins: manifest.plugins,
    }),
  );
}
export async function verifyArtifact(
  directory: string,
): Promise<ArtifactManifest> {
  const manifest = JSON.parse(
    await readFile(join(directory, 'manifest.json'), 'utf8'),
  ) as ArtifactManifest;
  if (
    manifest.schemaVersion !== 1 ||
    !manifest.files ||
    !Array.isArray(manifest.routes)
  )
    throw new Error('Invalid artifact manifest');
  if (artifactIdentity(manifest) !== manifest.artifactDigest)
    throw new Error('Artifact manifest identity mismatch');
  for (const [path, hash] of Object.entries(manifest.files)) {
    const file = await confinedPath(directory, path);
    if (digest(await readFile(file)) !== hash)
      throw new Error(`Artifact checksum mismatch: ${path}`);
  }
  return manifest;
}
export async function safeOutput(
  root: string,
  output: string,
): Promise<string> {
  const base = await realpath(root);
  const target = resolve(base, output);
  const local = relative(base, target);
  if (!local.startsWith('.api-docs' + sep) || local.split(sep).includes('..'))
    throw new Error(
      'Build output must be inside the project .api-docs directory to protect source files',
    );
  let current = base;
  for (const part of local.split(sep)) {
    current = join(current, part);
    try {
      await mkdir(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const info = await lstat(current);
    if (info.isSymbolicLink() || !info.isDirectory())
      throw new Error(
        'Build output cannot contain symlinks or non-directory components',
      );
  }
  await confinedPath(base, target);
  return target;
}
