import { beforeAll, describe, expect, it } from 'vitest';
import {
  mkdtemp,
  writeFile,
  rm,
  symlink,
  mkdir,
  readFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { compileProject } from '@api-docs/compiler';
import { buildSite } from '@api-docs/cli';
import {
  runPluginFiles,
  checkPluginConformance,
  definePlugin,
} from '@api-docs/plugin-sdk';
import type { SiteData } from '@api-docs/contracts';
let site: SiteData;
beforeAll(async () => {
  site = await compileProject(resolve('examples/demo'));
});
async function fixture(code: string, run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'api-docs-plugin-'));
  try {
    await writeFile(join(root, 'plugin.mjs'), code);
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
const plugin = (transform = '(site) => site', extra = '') =>
  `export default { name: '@example/test', version: '1.0.0', pluginApi: '1', ${extra} transform: ${transform} };`;
describe('trusted plugin process and conformance boundary', () => {
  it('validates complete metadata and declared capabilities', () => {
    expect(() =>
      definePlugin({ name: 'test', version: '1.0.0trailing', pluginApi: '1' }),
    ).toThrow();
    expect(() =>
      definePlugin({
        name: 'test',
        version: '1.0.0',
        pluginApi: '1',
        capabilities: ['network'] as unknown as ['transform'],
      }),
    ).toThrow();
    expect(
      definePlugin({
        name: '@example/test',
        version: '1.2.3-beta.1+build',
        pluginApi: '1',
        inputs: ['helper.mjs'],
        capabilities: ['transform'],
      }).version,
    ).toContain('beta.1');
  });
  it('executes reproducibly without exposing plugin stdout/stderr or mutating caller data', async () => {
    const original = site.config.name;
    await fixture(
      plugin(
        '(site) => { console.log("plugin-log-marker"); console.error("plugin-error-marker"); site.config.name = "Transformed"; return site; }',
      ),
      async (root) => {
        const result = await checkPluginConformance(root, ['plugin.mjs'], site);
        expect(result.site.config.name).toBe('Transformed');
        expect(site.config.name).toBe(original);
        expect(result.plugins[0]).toMatchObject({
          name: '@example/test',
          version: '1.0.0',
          inputs: [
            {
              path: 'plugin.mjs',
              digest: expect.stringMatching(/^[a-f0-9]{64}$/),
            },
          ],
        });
      },
    );
  });
  it.each([
    '() => { while (true) { /* non-cooperative trusted code */ } }',
    '() => new Promise(() => {})',
  ])(
    'terminates unresponsive code using an external deadline (%s)',
    async (transform) => {
      await fixture(plugin(transform), async (root) => {
        await expect(
          runPluginFiles(root, ['plugin.mjs'], site, { timeoutMs: 300 }),
        ).rejects.toThrow(/execution limit/);
      });
    },
  );
  it.each([
    '(site) => { site.apis[0].operations[0].slug = "../../outside"; return site; }',
    '(site) => { site.guides.push(site.guides[0]); return site; }',
    '() => { throw new Error("sensitive-plugin-error-marker"); }',
  ])(
    'rejects malformed graph output and redacts arbitrary exceptions (%s)',
    async (transform) => {
      await fixture(plugin(transform), async (root) => {
        let failure: unknown;
        try {
          await runPluginFiles(root, ['plugin.mjs'], site);
        } catch (error) {
          failure = error;
        }
        expect(failure).toBeInstanceOf(Error);
        expect((failure as Error).message).not.toContain(
          'sensitive-plugin-error-marker',
        );
      });
    },
  );
  it('reloads transitive imports in fresh processes and fingerprints declared inputs', async () => {
    await fixture(
      `import { label } from './helper.mjs'; ${plugin('(site) => { site.config.name = label; return site; }', 'inputs: ["helper.mjs"],')}`,
      async (root) => {
        await writeFile(
          join(root, 'helper.mjs'),
          'export const label = "First";',
        );
        const first = await runPluginFiles(root, ['plugin.mjs'], site);
        await writeFile(
          join(root, 'helper.mjs'),
          'export const label = "Second";',
        );
        const second = await runPluginFiles(root, ['plugin.mjs'], site);
        expect(first.site.config.name).toBe('First');
        expect(second.site.config.name).toBe('Second');
        expect(first.plugins[0]!.sourceDigest).not.toBe(
          second.plugins[0]!.sourceDigest,
        );
        expect(second.plugins[0]!.inputs.map((input) => input.path)).toEqual([
          'helper.mjs',
          'plugin.mjs',
        ]);
      },
    );
  });
  it('rejects escaped entries and declared source inputs, including symlinks', async () => {
    await fixture(
      plugin('(site) => site', 'inputs: ["outside"],'),
      async (root) => {
        await symlink('/etc/hosts', join(root, 'outside'));
        await expect(runPluginFiles(root, ['outside'], site)).rejects.toThrow(
          /escapes/,
        );
        await expect(
          runPluginFiles(root, ['plugin.mjs'], site),
        ).rejects.toThrow(/worker failed/);
      },
    );
  });
  it('bounds output bytes and rejects declared files changed during execution', async () => {
    await fixture(
      plugin(
        '(site) => { site.config.description = "x".repeat(100_000); return site; }',
      ),
      async (root) => {
        await expect(
          runPluginFiles(root, ['plugin.mjs'], site, { maxBytes: 64 * 1024 }),
        ).rejects.toThrow(/worker failed|byte limit/);
      },
    );
    await fixture(
      `import { writeFileSync } from 'node:fs'; ${plugin('(site) => { writeFileSync("helper.mjs", "changed"); return site; }', 'inputs: ["helper.mjs"],')}`,
      async (root) => {
        await writeFile(join(root, 'helper.mjs'), 'original');
        await expect(
          runPluginFiles(root, ['plugin.mjs'], site),
        ).rejects.toThrow(/worker failed/);
      },
    );
  });
  it('detects nondeterminism rather than issuing a successful conformance report', async () => {
    await fixture(
      plugin(
        '(site) => { site.config.name = String(Math.random()); return site; }',
      ),
      async (root) => {
        await expect(
          checkPluginConformance(root, ['plugin.mjs'], site),
        ).rejects.toThrow(/differs/);
      },
    );
  });
  it('records fingerprints, sanitizes transformed guides, and preserves the prior build on invalid configuration', async () => {
    await fixture(
      plugin(
        '(site) => { site.guides[0].html = "<h2>Safe heading</h2><script>activeMarker()</script>"; return site; }',
      ),
      async (root) => {
        await mkdir(join(root, 'guides'));
        await writeFile(
          join(root, 'guides/introduction.md'),
          '# Hello\n\nExample.',
        );
        await writeFile(
          join(root, 'openapi.json'),
          JSON.stringify({
            openapi: '3.1.0',
            info: { title: 'Test', version: 'v1' },
            paths: {},
          }),
        );
        await writeFile(
          join(root, 'docs.config.yaml'),
          'name: Test\nspecs:\n  - id: api\n    path: openapi.json\nplugins:\n  - plugin.mjs\n',
        );
        await expect(compileProject(root)).rejects.toThrow(/trust-plugins/);
        const first = await buildSite(root, { trustPlugins: true });
        expect(first.site.guides[0]!.html).not.toContain('script');
        expect(first.manifest.plugins[0]!.sourceDigest).toMatch(
          /^[a-f0-9]{64}$/,
        );
        const manifest = await readFile(
          join(first.directory, 'manifest.json'),
          'utf8',
        );
        await writeFile(
          join(root, 'plugin.mjs'),
          plugin(
            '(site) => { site.config.basePath = "<script>"; return site; }',
          ),
        );
        await expect(buildSite(root, { trustPlugins: true })).rejects.toThrow(
          /plugin project configuration/,
        );
        expect(
          await readFile(join(first.directory, 'manifest.json'), 'utf8'),
        ).toBe(manifest);
        const check = spawnSync(
          process.execPath,
          [
            resolve('packages/cli/dist/main.js'),
            'plugin-check',
            'plugin.mjs',
            root,
          ],
          { encoding: 'utf8' },
        );
        expect(check.status).not.toBe(0);
        expect(check.stderr).toContain('trust-plugins');
      },
    );
  });
});
