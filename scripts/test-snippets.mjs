import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { generateSnippet, encodeFormBody } from '@api-docs/explorer';

const exec = promisify(execFile);
const directory = await mkdtemp(join(tmpdir(), 'api-docs-snippets-'));
const languages = ['cURL', 'JavaScript', 'TypeScript', 'Python', 'Java'];
const cases = [
  {
    name: 'get',
    status: 200,
    type: 'text/plain',
    body: 'bodyless request',
    expected: 'bodyless request',
    method: 'GET',
  },
  {
    name: 'json-body',
    status: 200,
    type: 'application/json',
    body: '{"received":true}',
    expected: 'received',
    requestBody: JSON.stringify({
      enabled: false,
      value: null,
      message: 'quotes " and \\ café 😀',
    }),
  },
  {
    name: 'form-body',
    status: 200,
    type: 'application/json',
    body: '{"encoded":true}',
    expected: 'encoded',
    requestType: 'application/x-www-form-urlencoded',
    requestBody: encodeFormBody(
      '{"name":"café + space","id":9007199254740993,"colors":["a+b","x&y"],"address":{"zip":"99999+1234"}}',
      {
        schema: { type: 'object' },
      },
    ),
  },
  {
    name: 'json',
    status: 200,
    type: 'application/problem+json; charset=utf-8',
    body: '{"ok":true}',
    expected: 'ok',
  },
  {
    name: 'text',
    status: 200,
    type: 'text/plain',
    body: 'plain response',
    expected: 'plain response',
  },
  { name: 'empty', status: 204, type: 'text/plain', body: '', expected: '' },
  {
    name: 'error',
    status: 418,
    type: 'text/plain',
    body: 'fixture error',
    fails: true,
  },
  {
    name: 'redirect',
    status: 302,
    type: 'text/plain',
    body: 'redirect',
    expected: 'redirect',
  },
];
const received = [];
const server = createServer(async (request, response) => {
  const match = cases.find(
    (item) => request.url?.split('?')[0] === `/${item.name}`,
  );
  if (!match) {
    response.writeHead(500).end('unexpected destination');
    return;
  }
  const parts = [];
  for await (const part of request) parts.push(part);
  const body = Buffer.concat(parts).toString('utf8');
  received.push({
    url: request.url,
    method: request.method,
    headers: request.headers,
    body,
  });
  response
    .writeHead(match.status, {
      'Content-Type': match.type,
      ...(match.name === 'redirect' ? { Location: '/forbidden-follow' } : {}),
    })
    .end(match.body);
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
assert(address && typeof address !== 'string');
let passed = 0;
try {
  for (const language of languages) {
    for (const fixture of cases) {
      const input = {
        url: `http://127.0.0.1:${address.port}/${fixture.name}?q=a%26b`,
        method: fixture.method ?? 'POST',
        headers: {
          Accept: fixture.type,
          'Content-Type':
            fixture.requestType ??
            (fixture.name === 'json-body'
              ? 'application/json'
              : 'text/plain; charset=utf-8'),
          Authorization: 'Bearer fixture-token',
          'X-Fixture': 'quote" backslash\\',
        },
        ...(fixture.method === 'GET'
          ? {}
          : {
              body:
                fixture.requestBody ??
                '@not-a-file\n  quotes "double" and \'single\' \\ café 😀  ',
            }),
      };
      const extension = {
        cURL: 'sh',
        JavaScript: 'mjs',
        TypeScript: 'mts',
        Python: 'py',
        Java: 'java',
      }[language];
      const file = join(
        directory,
        language === 'Java' ? 'Example.java' : `example.${extension}`,
      );
      await writeFile(file, generateSnippet(input, language));
      const command = {
        cURL: 'sh',
        JavaScript: process.execPath,
        TypeScript: process.execPath,
        Python: 'python3',
        Java: 'java',
      }[language];
      let output = '',
        failed = false;
      const before = received.length;
      try {
        const result = await exec(command, [file], {
          timeout: 15_000,
          maxBuffer: 1024 * 1024,
          cwd: directory,
        });
        output = result.stdout;
      } catch (error) {
        assert.equal(
          error.killed,
          false,
          `${language}/${fixture.name}: subprocess timed out`,
        );
        assert.equal(
          typeof error.code,
          'number',
          `${language}/${fixture.name}: required runtime is unavailable`,
        );
        failed = true;
      }
      // cURL reports 3xx without following; other clients reject redirects.
      const shouldFail = Boolean(
        fixture.fails || (fixture.name === 'redirect' && language !== 'cURL'),
      );
      assert.equal(
        failed,
        shouldFail,
        `${language}/${fixture.name}: unexpected process result`,
      );
      assert.equal(
        received.length,
        before + 1,
        `${language}/${fixture.name}: exactly one request must arrive`,
      );
      const actual = received.at(-1);
      assert.equal(actual.url, `/${fixture.name}?q=a%26b`);
      assert.equal(actual.method, input.method);
      assert.equal(
        actual.body,
        input.body ?? '',
        `${language}/${fixture.name}: request bytes changed`,
      );
      assert.equal(actual.headers.accept, input.headers.Accept);
      assert.equal(
        actual.headers['content-type'],
        input.headers['Content-Type'],
      );
      assert.equal(actual.headers.authorization, input.headers.Authorization);
      assert.equal(actual.headers['x-fixture'], input.headers['X-Fixture']);
      if (!shouldFail && fixture.expected)
        assert(
          output.includes(fixture.expected),
          `${language}/${fixture.name}: response was not displayed`,
        );
      passed++;
      console.log(`PASS ${language}: ${fixture.name}`);
    }
  }
  assert.equal(passed, 40);
  console.log(
    `${passed} executable snippet checks passed across ${languages.length} languages.`,
  );
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
