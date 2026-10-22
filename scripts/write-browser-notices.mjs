import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const output = resolve(process.argv[2] ?? 'dist/client');
const packages = new Set(['vite']); // Includes the generated module-preload helper.
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) await walk(join(directory, entry.name));
    else if (entry.name.endsWith('.js.map')) {
      const map = JSON.parse(
        await readFile(join(directory, entry.name), 'utf8'),
      );
      for (const source of map.sources ?? []) {
        const name = source.match(
          /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)/,
        )?.[1];
        if (name) packages.add(name);
      }
    }
  }
}
await walk(output);
assert(
  packages.has('react') && packages.has('react-dom'),
  'Expected React browser bundle source maps',
);
const sections = [
  'Third-party notices for the bundled browser code.\nProject code is licensed under Apache-2.0. Dependencies retain their own licenses.\n',
];
for (const name of [...packages].sort()) {
  const file = require.resolve(`${name}/package.json`);
  const metadata = JSON.parse(await readFile(file, 'utf8'));
  const files = await readdir(dirname(file));
  const license = files.find((name) =>
    /^licen[cs]e(?:\.(?:md|txt))?$/i.test(name),
  );
  assert(
    license,
    `${name}: missing license text; review the bundled dependency`,
  );
  sections.push(
    `${name}@${metadata.version}\nLicense: ${metadata.license ?? 'See full text'}\n\n${await readFile(join(dirname(file), license), 'utf8')}`,
  );
}
await writeFile(
  join(output, 'assets/THIRD_PARTY_NOTICES.txt'),
  sections.join('\n\n' + '='.repeat(72) + '\n\n'),
);
console.log(
  `Browser notices include ${packages.size} bundled dependencies/helpers.`,
);
