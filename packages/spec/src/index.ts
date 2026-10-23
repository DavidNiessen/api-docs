import { relative } from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';
import type { ApiDocument } from '@api-docs/contracts';
import {
  confinedPath,
  parseSource,
  readTextFile,
  record,
  text,
} from './source.js';
import { normalizeSpec } from './normalize.js';
export { configSchema, parseConfig } from './config.js';
export {
  confinedPath,
  parseSource,
  readTextFile,
  readBoundedFile,
  record,
  text,
  array,
} from './source.js';
export { resolveSchema, exampleFor } from '@api-docs/contracts';
export { diffApi } from './diff.js';
export type { ContractChange } from './diff.js';
export { checkExamples } from './examples.js';
export { downloadSpec } from './remote.js';
export type { RemoteSpecOptions, RemoteSpecSnapshot } from './remote.js';

export async function loadSpec(
  root: string,
  input: { id: string; path: string; version?: string },
): Promise<ApiDocument> {
  const filename = await confinedPath(root, input.path);
  const source = await readTextFile(filename);
  const parsed = record(parseSource(source, input.path));
  if (!/^3\.(0|1)\.\d+$/.test(text(parsed.openapi)))
    throw new Error(
      `${input.path}: supported versions are OpenAPI 3.0.x and 3.1.x`,
    );
  let files = 0,
    bytes = Buffer.byteLength(source);
  const parser = new SwaggerParser();
  const bundled = await parser.bundle(
    filename,
    parsed as unknown as typeof parser.api,
    {
      resolve: {
        http: false,
        file: {
          order: 100,
          canRead: true,
          read: async (file: { url: string }) => {
            if (++files > 128)
              throw new Error('Reference limit exceeded (128 files)');
            if (/^[a-z]+:/i.test(file.url))
              throw new Error(
                'Remote references are disabled; vendor the referenced file locally',
              );
            const path = await confinedPath(root, file.url);
            const source = await readTextFile(path);
            bytes += Buffer.byteLength(source);
            if (bytes > 64 * 1024 * 1024)
              throw new Error('Referenced inputs exceed 64 MiB total');
            return JSON.stringify(parseSource(source, relative(root, path)));
          },
        },
      },
    },
  );
  // Validate a separate graph: dereferencing must not replace the portable refs
  // in our normalized model or introduce cyclic objects into JSON output.
  try {
    await SwaggerParser.validate(filename, structuredClone(bundled), {
      resolve: { external: false, http: false, file: false },
      dereference: { circular: 'ignore' },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Invalid OpenAPI document';
    throw new Error(`${input.path}: ${message.slice(0, 12_000)}`, {
      cause: error,
    });
  }
  return normalizeSpec(record(bundled), input);
}
