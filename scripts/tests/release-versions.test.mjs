import test from 'node:test';
import { inc } from 'semver';
import assert from 'node:assert/strict';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditReleaseVersions } from '../lib/release-versions.mjs';
import { readWorkspacePackages } from '../lib/workspaces.mjs';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const BASE_VERSION = JSON.parse(
  await readFile(join(repository, 'package.json'), 'utf8'),
).version;
const OTHER_VERSION = inc(BASE_VERSION, 'major');
assert(OTHER_VERSION);
const poms = [
  'integrations/java/pom.xml',
  'integrations/java/core/pom.xml',
  'integrations/java/spring-boot-starter/pom.xml',
];
const json = async (root, path) =>
  JSON.parse(await readFile(join(root, path), 'utf8'));
async function editJson(root, path, change) {
  const data = await json(root, path);
  change(data);
  await writeFile(join(root, path), JSON.stringify(data, null, 2) + '\n');
}
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'api-docs-versions-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const paths = [
    ...(await readWorkspacePackages(repository)).map(
      (pkg) => (pkg.path ? pkg.path + '/' : '') + 'package.json',
    ),
    'package-lock.json',
    'packages/contracts/src/version.ts',
    ...poms,
  ];
  for (const path of paths) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await cp(join(repository, path), join(root, path));
  }
  for (const path of poms) {
    const file = join(root, path);
    await writeFile(
      file,
      (await readFile(file, 'utf8')).replace(
        /(<artifactId>api-docs-parent<\/artifactId>\s*<version>)[^<]+(<\/version>)/g,
        (_match, prefix, suffix) =>
          prefix + BASE_VERSION + '-SNAPSHOT' + suffix,
      ),
    );
  }
  return root;
}
test('all npm/runtime/lockfile and Maven versions align without changing files', async (t) => {
  const root = await fixture(t),
    lock = await readFile(join(root, 'package-lock.json'), 'utf8');
  const report = await auditReleaseVersions(root);
  assert.deepEqual(report, {
    version: BASE_VERSION,
    mode: 'development',
    nodePackages: 15,
    publicPackages: 12,
    javaVersion: BASE_VERSION + '-SNAPSHOT',
    javaPoms: 3,
  });
  assert.equal(await readFile(join(root, 'package-lock.json'), 'utf8'), lock);
  await assert.rejects(
    auditReleaseVersions(root, { release: true }),
    /without SNAPSHOT/,
  );
});
test('release mode requires identical Maven coordinates and allows the aligned release', async (t) => {
  const root = await fixture(t);
  for (const path of poms)
    await writeFile(
      join(root, path),
      (await readFile(join(root, path), 'utf8')).replaceAll(
        BASE_VERSION + '-SNAPSHOT',
        BASE_VERSION,
      ),
    );
  assert.equal(
    (await auditReleaseVersions(root, { release: true })).mode,
    'release',
  );
});
const mutations = [
  [
    'workspace declaration drift',
    (root) =>
      editJson(root, 'package.json', (data) => {
        data.workspaces = ['apps/*'];
      }),
    /Workspace lockfile declarations/,
  ],
  [
    'missing workspace manifest',
    (root) => unlink(join(root, 'packages/contracts/package.json')),
    /Workspace lockfile inventory/,
  ],
  [
    'workspace metadata',
    (root) =>
      editJson(root, 'packages/contracts/package.json', (data) => {
        data.version = OTHER_VERSION;
      }),
    /Workspace version drift/,
  ],
  [
    'root lock version',
    (root) =>
      editJson(root, 'package-lock.json', (data) => {
        data.version = OTHER_VERSION;
      }),
    /Root lockfile/,
  ],
  [
    'workspace lock version',
    (root) =>
      editJson(root, 'package-lock.json', (data) => {
        data.packages['apps/reader'].version = OTHER_VERSION;
      }),
    /Workspace lockfile/,
  ],
  [
    'workspace link',
    (root) =>
      editJson(root, 'package-lock.json', (data) => {
        data.packages['node_modules/@api-docs/contracts'].resolved =
          'different';
      }),
    /Workspace link/,
  ],
  [
    'internal lock reference',
    (root) =>
      editJson(root, 'package-lock.json', (data) => {
        delete data.packages['packages/cli'].dependencies[
          '@api-docs/contracts'
        ];
      }),
    /Internal lockfile dependency/,
  ],
  [
    'internal caret range',
    async (root) => {
      await editJson(root, 'packages/cli/package.json', (data) => {
        data.dependencies['@api-docs/contracts'] = '^' + BASE_VERSION;
      });
      await editJson(root, 'package-lock.json', (data) => {
        data.packages['packages/cli'].dependencies['@api-docs/contracts'] =
          '^' + BASE_VERSION;
      });
    },
    /exact unified version/,
  ],
  [
    'runtime version',
    (root) =>
      writeFile(
        join(root, 'packages/contracts/src/version.ts'),
        `export const toolVersion = '${OTHER_VERSION}';\n`,
      ),
    /Runtime distribution/,
  ],
  [
    'Java parent mismatch',
    async (root) => {
      const path = join(root, poms[1]);
      await writeFile(
        path,
        (await readFile(path, 'utf8')).replace(
          BASE_VERSION + '-SNAPSHOT',
          OTHER_VERSION + '-SNAPSHOT',
        ),
      );
    },
    /Java parent versions/,
  ],
  [
    'Java internal dependency',
    async (root) => {
      const path = join(root, poms[2]);
      await writeFile(
        path,
        (await readFile(path, 'utf8')).replace(
          '${project.version}',
          BASE_VERSION,
        ),
      );
    },
    /Java internal dependencies/,
  ],
  [
    'private runtime dependency',
    async (root) => {
      await editJson(root, 'packages/cli/package.json', (data) => {
        data.dependencies['@api-docs/server'] = BASE_VERSION;
      });
      await editJson(root, 'package-lock.json', (data) => {
        data.packages['packages/cli'].dependencies['@api-docs/server'] =
          BASE_VERSION;
      });
    },
    /private workspace/,
  ],
  [
    'duplicate package',
    (root) =>
      editJson(root, 'packages/contracts/package.json', (data) => {
        data.name = 'api-docs';
      }),
    /Duplicate workspace/,
  ],
  [
    'unsafe workspace glob',
    (root) =>
      editJson(root, 'package.json', (data) => {
        data.workspaces = ['../outside'];
      }),
    /Unsupported workspace pattern/,
  ],
];
for (const [name, change, message] of mutations)
  test(`rejects ${name}`, async (t) => {
    const root = await fixture(t);
    await change(root);
    await assert.rejects(auditReleaseVersions(root), message);
  });
for (const version of ['v0.1.0', '01.0.0', '0.1.0+build', '0.1'])
  test(`rejects noncanonical distribution version ${version}`, async (t) => {
    const root = await fixture(t);
    await editJson(root, 'package.json', (data) => {
      data.version = version;
    });
    await assert.rejects(auditReleaseVersions(root), /canonical SemVer/);
  });
test('refuses metadata symlinks outside the checkout', async (t) => {
  const root = await fixture(t),
    outside = await mkdtemp(join(tmpdir(), 'api-docs-outside-version-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(
    join(outside, 'outside.json'),
    '{"private":"fixture-only-outside"}',
  );
  const path = join(root, 'packages/contracts/package.json');
  await unlink(path);
  await symlink(join(outside, 'outside.json'), path);
  await assert.rejects(auditReleaseVersions(root), /inside the checkout/);
});
