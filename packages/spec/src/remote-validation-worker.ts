import { parentPort, workerData } from 'node:worker_threads';
import SwaggerParser from '@apidevtools/swagger-parser';
import { parseSource, record, text } from './source.js';

try {
  const parsed = record(parseSource(workerData as string, 'imported-spec'));
  if (!/^3\.(0|1)\.\d+$/.test(text(parsed.openapi)))
    throw new Error('Unsupported OpenAPI version');
  const queue: unknown[] = [parsed];
  for (let index = 0; index < queue.length; index++) {
    const value = queue[index];
    if (!value || typeof value !== 'object') continue;
    for (const [key, child] of Object.entries(value)) {
      if (
        ['$ref', '$dynamicRef', '$recursiveRef'].includes(key) &&
        typeof child === 'string' &&
        !child.startsWith('#')
      ) {
        parentPort!.postMessage({
          error:
            'Imported specs must be self-contained; external references are disabled',
        });
        process.exit(0);
      }
      if (child && typeof child === 'object') queue.push(child);
    }
  }
  const parser = new SwaggerParser();
  await parser.validate(parsed as unknown as typeof parser.api, {
    resolve: { external: false, http: false, file: false },
    dereference: { circular: 'ignore' },
  });
  parentPort!.postMessage({ valid: true });
} catch {
  // Downloaded payloads and validator excerpts may contain credentials.
  parentPort!.postMessage({
    error:
      'Imported source failed bounded YAML/JSON or OpenAPI 3.0/3.1 validation',
  });
}
