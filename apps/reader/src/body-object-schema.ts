import { resolveSchema } from '@api-docs/contracts';
import type { Schema } from '@api-docs/contracts';

const annotations = new Set([
  'title',
  'description',
  'default',
  'example',
  'examples',
  'deprecated',
  'readOnly',
  'writeOnly',
  'nullable',
  'externalDocs',
  'xml',
  '$comment',
]);
const shape = new Set(['type', 'properties', 'required', 'allOf']);
const isObject = (value: unknown): value is Schema =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** A conservative form projection, never a replacement for schema validation. */
export function objectFieldSchema(
  schema: Schema,
  schemas: Record<string, Schema>,
  legacy: boolean,
): Schema {
  const resolve = (value: Schema) =>
    resolveSchema(value, schemas, { ignoreReferenceSiblings: legacy });
  const actual = resolve(schema);
  if (!Object.hasOwn(actual, 'allOf')) return actual;
  const properties = new Map<string, unknown>(),
    required = new Set<string>(),
    metadata = new Map<string, unknown>();
  let visited = 0,
    nullable = true,
    typed = false,
    readOnly = false,
    writeOnly = false;
  function visit(value: Schema, depth: number) {
    if (++visited > 32 || depth >= 8)
      throw new Error(
        'Use JSON for object compositions beyond 32 nodes or eight levels.',
      );
    const branch = resolve(value);
    if (
      Object.keys(branch).some(
        (key) => !annotations.has(key) && !shape.has(key),
      )
    )
      throw new Error(
        'Use JSON for object compositions with additional constraints.',
      );
    if (branch.type !== undefined) {
      const types = Array.isArray(branch.type) ? branch.type : [branch.type];
      if (
        !types.includes('object') ||
        types.some((type) => type !== 'object' && type !== 'null')
      )
        throw new Error('Use JSON for non-object composition branches.');
      typed = true;
      nullable &&= legacy ? branch.nullable === true : types.includes('null');
    }
    readOnly ||= branch.readOnly === true;
    writeOnly ||= branch.writeOnly === true;
    for (const [key, value] of Object.entries(branch))
      if (annotations.has(key) && !metadata.has(key)) metadata.set(key, value);
    if (branch.properties !== undefined) {
      if (!isObject(branch.properties))
        throw new Error('Use JSON for invalid composition properties.');
      for (const [key, value] of Object.entries(branch.properties)) {
        if (properties.has(key))
          throw new Error('Use JSON for overlapping composition properties.');
        properties.set(key, value);
      }
    }
    if (branch.required !== undefined) {
      if (
        !Array.isArray(branch.required) ||
        branch.required.some((key) => typeof key !== 'string')
      )
        throw new Error('Use JSON for invalid composition requirements.');
      for (const key of branch.required) required.add(key as string);
    }
    if (Object.hasOwn(branch, 'allOf')) {
      if (
        !Array.isArray(branch.allOf) ||
        !branch.allOf.length ||
        branch.allOf.some((child) => !isObject(child))
      )
        throw new Error('Use JSON for unsupported composition branches.');
      for (const child of branch.allOf) visit(child as Schema, depth + 1);
    }
  }
  visit(actual, 0);
  return {
    ...Object.fromEntries(metadata),
    type: !legacy && typed && nullable ? ['object', 'null'] : 'object',
    nullable: legacy && typed && nullable,
    readOnly,
    writeOnly,
    properties: Object.fromEntries(properties),
    required: [...required],
  };
}
