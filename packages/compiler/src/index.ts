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
import { loadPublicAssets } from './assets.js';
export { loadPublicAssets } from './assets.js';
import type { BuildPlugin } from '@api-docs/plugin-sdk';
import type { SiteData, ArtifactManifest } from '@api-docs/contracts';

export const digest = (source: string | Buffer): string =>
  createHash('sha256').update(source).digest('hex');
export async function compileProject(
  root: string,
  configFile = 'docs.config.yaml',
  options: { trustPlugins?: boolean; trustContent?: boolean } = {},
): Promise<SiteData> {
  root = await realpath(root);
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
  const assets = await loadPublicAssets(root, config);
  let site: SiteData = {
    assetMetadata: [...assets].map(([path, value]) => ({
      path,
      hash: digest(value),
    })),
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
/** Reuse the API graph only when a plain Markdown body changes without affecting shared navigation. */
export async function compileGuideUpdate(
  root: string,
  site: SiteData,
  changes: string[],
): Promise<SiteData | undefined> {
  if (
    !changes.length ||
    site.config.plugins.length ||
    site.guides.some(
      (guide) =>
        guide.source.endsWith('.mdx') || guide.sourceBytes === undefined,
    )
  )
    return undefined;
  root = await realpath(root);
  const known = new Set(
    site.guides.map((guide) => resolve(root, guide.source)),
  );
  const files = new Set<string>();
  for (const path of changes) {
    const candidate = resolve(root, path);
    if (!candidate.endsWith('.md') || !known.has(candidate)) return undefined;
    try {
      files.add(await confinedPath(root, candidate));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  }
  const changed = await loadGuides(root, site.config.guides, {
    only: files,
    basePath: site.config.basePath,
  });
  if (changed.length !== files.size) return undefined;
  const navigation = (guide: SiteData['guides'][number]) =>
    JSON.stringify([
      guide.source,
      guide.slug,
      guide.title,
      guide.description,
      guide.group,
      guide.order,
    ]);
  const replacements = new Map(changed.map((guide) => [guide.source, guide]));
  for (const guide of site.guides) {
    const next = replacements.get(guide.source);
    if (next && navigation(next) !== navigation(guide)) return undefined;
  }
  const guides = site.guides.map(
    (guide) => replacements.get(guide.source) ?? guide,
  );
  if (
    guides.reduce((total, guide) => total + (guide.sourceBytes ?? 0), 0) >
    64 * 1024 * 1024
  )
    throw new Error('Guide sources exceed 64 MiB total');
  return { ...site, guides };
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
