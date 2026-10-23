import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import express from 'express';
import Fastify from 'fastify';
import { createStaticServer } from '@api-docs/cli';
import { verifyArtifact } from '@api-docs/compiler';
import { downloadSpec } from '@api-docs/spec';
import { createExpressDocs } from '@api-docs/node/express';
import { apiDocsPlugin } from '@api-docs/node/fastify';
import {
  parseJsonValue,
  serializeJsonValue,
  setJsonProperty,
  toolVersion,
} from '@api-docs/contracts';
import {
  redactJsonBody,
  encodeFormBody,
  createMultipartParts,
  toFetchRequest,
  generateSnippet,
  redactRequest,
} from '@api-docs/explorer';

const exec = promisify(execFile);
const uploadRequest = {
  url: 'https://api.example.test/upload',
  method: 'POST',
  headers: {},
  multipart: createMultipartParts(
    '{"id":9007199254740993,"password":"installed-upload-secret"}',
    {
      attachment: [
        {
          filename: 'installed.bin',
          data: new Blob([Uint8Array.from([0, 255, 128])]),
        },
      ],
    },
    {
      schema: {
        type: 'object',
        properties: {
          attachment: { type: 'string', format: 'binary' },
          password: { type: 'string', writeOnly: true },
        },
      },
    },
  ),
};
const multipart = toFetchRequest(uploadRequest);
const uploadPreview = redactRequest(
  uploadRequest,
  {},
  {
    schema: { type: 'object', properties: { password: { writeOnly: true } } },
    schemas: {},
  },
);
assert(!JSON.stringify(uploadPreview).includes('installed-upload-secret'));
assert(
  uploadPreview.multipart.some(
    (part) =>
      part.kind === 'text' &&
      part.name === 'id' &&
      part.value === '9007199254740993',
  ),
);
for (const language of ['cURL', 'JavaScript', 'TypeScript', 'Python', 'Java']) {
  const code = generateSnippet(uploadRequest, language);
  assert(code.includes('YOUR_FILE_1'));
  assert(!code.includes('installed.bin'));
}
const uploaded = await new Response(multipart.body, {
  headers: multipart.headers,
}).formData();
assert.equal(uploaded.get('id'), '9007199254740993');
assert.deepEqual(
  new Uint8Array(await uploaded.get('attachment').arrayBuffer()),
  Uint8Array.from([0, 255, 128]),
);
assert.equal(
  encodeFormBody('{"name":"installed + form","id":9007199254740993}', {
    schema: { type: 'object' },
  }),
  'name=installed+%2B+form&id=9007199254740993',
);
const parsedBody = parseJsonValue(
  '{"id":9007199254740993,"password":"fixture-only"}',
);
assert.equal(parsedBody.kind, 'object');
const editedBody = serializeJsonValue(
  setJsonProperty(parsedBody, 'name', { kind: 'string', value: 'installed' }),
);
assert(editedBody.includes('9007199254740993'));
assert(
  !redactJsonBody(editedBody, {
    schema: { properties: { password: { writeOnly: true } } },
    schemas: {},
  }).includes('fixture-only'),
);
const root = process.cwd();
const metadata = JSON.parse(await readFile('package.json', 'utf8'));
const typeImports = [];
for (const name of Object.keys(metadata.dependencies).filter((name) =>
  name.startsWith('@api-docs/'),
)) {
  const entry =
    name === '@api-docs/reader'
      ? `${name}/render`
      : name === '@api-docs/node'
        ? `${name}/express`
        : name;
  assert(
    fileURLToPath(import.meta.resolve(entry)).startsWith(
      join(root, 'node_modules') + '/',
    ),
  );
  assert.equal(
    (await lstat(join(root, 'node_modules', name))).isSymbolicLink(),
    false,
    `${name}: workspace symlink bypasses package verification`,
  );
  typeImports.push(
    `import * as Component${typeImports.length} from ${JSON.stringify(entry)};\nvoid Component${typeImports.length};`,
  );
}
await writeFile(
  'types.mts',
  typeImports.join('\n') +
    `\nimport { definePlugin } from '@api-docs/plugin-sdk';\nimport type { ThemePatch, BuildPluginContext, SpecSource, SnippetInput, SnippetSample } from '@api-docs/plugin-sdk';\nimport type { SiteData } from '@api-docs/contracts';\nimport { createExpressDocs } from '@api-docs/node/express';\nimport { apiDocsPlugin } from '@api-docs/node/fastify';\nimport { buildSite } from '@api-docs/cli';\nconst plugin = definePlugin({ name: 'installed-types', version: '1.0.0', pluginApi: '1', capabilities: ['source', 'theme', 'transform', 'snippets'], loadSpec: (source: Readonly<SpecSource>) => source.content, theme: (theme, context: BuildPluginContext): ThemePatch => ({ radius: context.signal.aborted ? theme.radius : 12 }), transform: (site: SiteData) => site, generateSnippets: ({operation}: SnippetInput): SnippetSample[] => [{id:'sdk', label:'SDK', language:'javascript', code:operation.id}] });\nvoid [plugin, createExpressDocs, apiDocsPlugin, buildSite];\n`,
);
await exec(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--noEmit',
  '--strict',
  '--module',
  'NodeNext',
  '--moduleResolution',
  'NodeNext',
  '--target',
  'ES2023',
  '--skipLibCheck',
  'false',
  '--types',
  'node',
  'types.mts',
]);
const cli = fileURLToPath(import.meta.resolve('@api-docs/cli')).replace(
  /index\.js$/,
  'main.js',
);
const version = JSON.parse(
  await readFile('node_modules/@api-docs/cli/package.json', 'utf8'),
).version;
assert.equal(toolVersion, version);
assert.equal(
  (
    await exec(join(root, 'node_modules/.bin/api-docs'), ['--version'])
  ).stdout.trim(),
  version,
);
await exec(process.execPath, [cli, 'init', 'docs']);
const importedSource = Buffer.from(
  '{"openapi":"3.1.0","info":{"title":"Packaged remote snapshot","version":"v1"},"paths":{},"components":{"schemas":{"Id":{"type":"integer","example":9007199254740993}}}}\n',
);
const importedDigest = createHash('sha256')
  .update(importedSource)
  .digest('hex');
const sourceServer = createServer((_request, response) =>
  response.end(importedSource),
);
await new Promise((resolve, reject) => {
  sourceServer.once('error', reject);
  sourceServer.listen(0, '127.0.0.1', resolve);
});
try {
  const address = sourceServer.address();
  assert(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const snapshot = await downloadSpec(origin + '/openapi', {
    allowedOrigins: [origin],
    allowHttp: true,
    allowPrivateNetwork: true,
    expectedSha256: importedDigest,
  });
  assert.deepEqual(snapshot.source, importedSource);
  const imported = await exec(process.execPath, [
    cli,
    'import-spec',
    origin + '/openapi',
    'docs',
    '--allow-origin',
    origin,
    '--allow-http',
    '--allow-private-network',
    '--sha256',
    importedDigest,
    '--output',
    'downloaded.json',
  ]);
  assert(imported.stdout.includes(importedDigest));
  assert.deepEqual(await readFile('docs/downloaded.json'), importedSource);
} finally {
  sourceServer.closeAllConnections();
  await new Promise((resolve) => sourceServer.close(resolve));
}
await exec(process.execPath, [cli, 'doctor', 'docs', '--strict']);
const config = join(root, 'docs/docs.config.yaml');
await writeFile(
  config,
  (await readFile(config, 'utf8')) +
    '\nbasePath: /reference\nplugins:\n  - plugin.mjs\n',
);
await writeFile(
  'docs/plugin.mjs',
  `import { definePlugin } from '@api-docs/plugin-sdk';\nexport default definePlugin({ name: 'installed-consumer', version: '1.0.0', pluginApi: '1', capabilities: ['source', 'theme', 'transform', 'snippets'], loadSpec: (source) => source.content.replace('title: My API', 'title: Installed source API'), theme: () => ({ radius: 12, colors: { light: { surface: '#f4f8f6' } } }), transform: (site) => { if (site.config.theme.radius !== 12 || site.apis[0].title !== 'Installed source API') throw new Error('Source/theme hooks did not precede transform'); return { ...site, config: { ...site.config, name: 'Packaged consumer' }, apis: site.apis.map((api, i) => i ? api : { ...api, operations: api.operations.map((op, j) => j ? op : { ...op, lifecycle: { sunsetOn: '2028-01-01', message: 'Packaged lifecycle metadata' } }) }) }; }, generateSnippets({operation}) { return [{id:'sdk', label:'Installed SDK', language:'javascript', code:'console.log('+JSON.stringify(operation.id)+');'}]; } });\n`,
);
await writeFile(
  'docs/guides/installed.mdx',
  '---\ntitle: Installed consumer\n---\n\n<Callout>Packaged MDX works.</Callout>\n',
);
await exec(process.execPath, [
  cli,
  'plugin-check',
  'plugin.mjs',
  'docs',
  '--trust-plugins',
  '--trust-content',
]);
await exec(process.execPath, [
  cli,
  'build',
  'docs',
  '--trust-plugins',
  '--trust-content',
]);
await exec(process.execPath, [
  cli,
  'doctor',
  'docs',
  '--strict',
  '--trust-plugins',
  '--trust-content',
]);
const directory = join(root, 'docs/.api-docs/site');
const manifest = await verifyArtifact(directory);
assert.equal(manifest.compilerVersion, version);
const installedSite = JSON.parse(
  await readFile(join(directory, 'site.json'), 'utf8'),
);
assert.equal(installedSite.config.theme.radius, 12);
assert.equal(installedSite.config.theme.colors.light.surface, '#f4f8f6');
assert.equal(installedSite.apis[0].title, 'Installed source API');
assert.equal(
  installedSite.apis[0].operations[0].codeSamples[0].plugin,
  'installed-consumer',
);
assert(
  installedSite.apis[0].operations[0].codeSamples[0].code.includes('getHealth'),
);
assert(
  (await readFile(join(directory, 'index.html'), 'utf8')).includes(
    `content="api-docs ${version}"`,
  ),
);
const lifecycle = JSON.parse(
  (
    await exec(process.execPath, [
      cli,
      'lifecycle',
      'docs',
      '--as-of',
      '2027-05-15',
      '--json',
      '--trust-plugins',
      '--trust-content',
    ])
  ).stdout,
);
assert.equal(lifecycle.total, 1);
assert.equal(lifecycle.entries[0].lifecycle.sunsetOn, '2028-01-01');
assert.equal(lifecycle.entries[0].status, 'planned');
assert(Object.keys(manifest.files).some((file) => file === 'assets/reader.js'));
assert(
  (
    await readFile(join(directory, 'guides/installed/index.html'), 'utf8')
  ).includes('Packaged MDX works.'),
);
await writeFile(join(directory, 'private.txt'), 'unlisted-consumer-fixture');
await writeFile(
  join(directory, 'assets/private.txt'),
  'unlisted-consumer-fixture',
);
const unlistedPaths = [
  '/reference/private.txt',
  '/reference/assets/private.txt',
  '/reference/manifest.json',
];
const staticServer = await createStaticServer(directory);
try {
  const response = await staticServer.inject('/reference/');
  assert.equal(response.statusCode, 200);
  assert(response.body.includes('Packaged consumer'));
  for (const url of unlistedPaths) {
    for (const method of ['GET', 'HEAD']) {
      const rejected = await staticServer.inject({ url, method });
      assert.equal(rejected.statusCode, 404);
      assert(!rejected.body.includes('unlisted-consumer-fixture'));
    }
  }
  await staticServer.reloadPublication();
  assert.equal((await staticServer.inject('/health/ready')).statusCode, 200);

  assert.equal(
    (await staticServer.inject('/reference/assets/reader.js')).statusCode,
    200,
  );
  const notices = await staticServer.inject(
    '/reference/assets/THIRD_PARTY_NOTICES.txt',
  );
  assert.equal(notices.statusCode, 200);
  assert(
    notices.body.includes('MIT License') && notices.body.includes('react-dom@'),
  );
} finally {
  await staticServer.close();
}
const headers = { authorization: 'Bearer fixture' };
const paths = [
  '/reference/',
  '/reference/guides/installed/',
  '/reference/assets/reader.js',
  '/reference/search.json',
  '/reference/site.json',
  '/reference/oauth/callback/',
  '/reference/assets/oauth-callback.js',
  '/reference/deprecations/',
  '/reference/deprecations/page-data.json',
];
const app = express();
const docs = await createExpressDocs({
  directory,
  authenticate: (request, response, next) =>
    request.headers.authorization === headers.authorization
      ? next()
      : response.sendStatus(401),
});
app.use(docs.mountPath, docs.router);
const listener = app.listen(0, '127.0.0.1');
await new Promise((resolve, reject) => {
  listener.once('error', reject);
  listener.once('listening', resolve);
});
try {
  const address = listener.address();
  assert(address && typeof address !== 'string');
  for (const path of paths) {
    assert.equal(
      (await fetch(`http://127.0.0.1:${address.port}${path}`)).status,
      401,
    );
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      headers,
    });
    assert.equal(response.status, 200);
    await response.arrayBuffer();
  }
  for (const path of unlistedPaths) {
    assert.equal(
      (await fetch(`http://127.0.0.1:${address.port}${path}`)).status,
      401,
    );
    for (const method of ['GET', 'HEAD']) {
      const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
        headers,
        method,
      });
      assert.equal(response.status, 404);
      assert(!(await response.text()).includes('unlisted-consumer-fixture'));
    }
  }
} finally {
  listener.closeAllConnections();
  await new Promise((resolve) => listener.close(resolve));
}
const fastify = Fastify();
try {
  await fastify.register(apiDocsPlugin, {
    directory,
    authenticate: async (request, reply) => {
      if (request.headers.authorization !== headers.authorization)
        return reply.code(401).send();
    },
  });
  for (const url of paths) {
    assert.equal((await fastify.inject(url)).statusCode, 401);
    assert.equal((await fastify.inject({ url, headers })).statusCode, 200);
  }
  for (const url of unlistedPaths) {
    assert.equal((await fastify.inject(url)).statusCode, 401);
    for (const method of ['GET', 'HEAD']) {
      const response = await fastify.inject({ url, headers, method });
      assert.equal(response.statusCode, 404);
      assert(!response.body.includes('unlisted-consumer-fixture'));
    }
  }
} finally {
  await fastify.close();
}
console.log(
  'Installed types, CLI, MDX/plugin workers, doctor, artifact checks and authenticated Express/Fastify subpaths passed.',
);
