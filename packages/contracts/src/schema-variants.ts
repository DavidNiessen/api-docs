import { resolveSchema } from './schema.js';
import type { Schema } from './index.js';

export interface SchemaVariant {
  label: string;
  schema: Schema;
}
export interface SchemaVariants {
  keyword: 'oneOf' | 'anyOf';
  choices: SchemaVariant[];
}
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
const object = (value: unknown): value is Schema =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Explicit editing choices, not branch matching or JSON Schema validation. */
export function schemaVariants(
  schema: Schema,
  schemas: Record<string, Schema>,
  legacy = false,
): SchemaVariants | undefined {
  const actual = resolveSchema(schema, schemas, {
    ignoreReferenceSiblings: legacy,
  });
  const keywords = (['oneOf', 'anyOf'] as const).filter((key) =>
    Object.hasOwn(actual, key),
  );
  if (keywords.length !== 1) return;
  const keyword = keywords[0]!,
    branches = actual[keyword];
  if (
    !Array.isArray(branches) ||
    !branches.length ||
    branches.length > 8 ||
    branches.some((branch) => !object(branch))
  )
    return;
  const base = Object.fromEntries(
    Object.entries(actual).filter(
      ([key]) => key !== keyword && key !== 'discriminator',
    ),
  );
  const constraints = Object.fromEntries(
    Object.entries(base).filter(([key]) => !annotations.has(key)),
  );
  return {
    keyword,
    choices: branches.map((branch: Schema, index) => {
      const resolved = resolveSchema(branch, schemas, {
        ignoreReferenceSiblings: legacy,
      });
      const title =
        typeof resolved.title === 'string'
          ? resolved.title.trim().slice(0, 96)
          : '';
      // Sibling constraints remain an intersection: a form projection may reject it,
      // but selecting a branch must never silently discard those constraints.
      const selected: Schema = Object.keys(constraints).length
        ? { allOf: [base, branch] }
        : {
            ...resolved,
            ...base,
            readOnly: base.readOnly === true || resolved.readOnly === true,
            writeOnly: base.writeOnly === true || resolved.writeOnly === true,
          };
      return {
        label: `${index + 1}. ${title || 'Option ' + (index + 1)}`,
        schema: selected,
      };
    }),
  };
}
