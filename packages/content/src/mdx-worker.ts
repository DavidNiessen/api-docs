import { evaluate } from '@mdx-js/mdx';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as runtime from 'react/jsx-runtime';
import { guideComponents } from './components.js';

async function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    input += String(chunk);
    if (Buffer.byteLength(input) > 4 * 1024 * 1024)
      throw new Error('MDX input exceeds worker limit');
  }
  const data = JSON.parse(input) as {
    source: string;
    filename: string;
    basePath: string;
  };
  const module = await evaluate(data.source, {
    ...runtime,
    baseUrl: data.filename,
  });
  const html = renderToStaticMarkup(
    createElement(module.default, {
      components: guideComponents(data.basePath),
    }),
  );
  if (Buffer.byteLength(html) > 4 * 1024 * 1024)
    throw new Error('MDX output exceeds 4 MiB');
  process.stdout.write(JSON.stringify({ html }));
}
void main().catch(() => {
  // Trusted content may throw messages containing build secrets. Do not relay them.
  process.stderr.write(
    'MDX compilation or rendering failed. Review syntax, imports and component props.\n',
  );
  process.exitCode = 1;
});
