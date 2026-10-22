import { parseJsonValue, resolveSchema } from '@api-docs/contracts';
import type { JsonValueNode, Schema } from '@api-docs/contracts';

export type ObjectBodyValue = Extract<JsonValueNode, { kind: 'object' }>;
export type ArrayBodyValue = Extract<JsonValueNode, { kind: 'array' }>;
export const MAX_ARRAY_ITEMS = 50;
type Unavailable = { available: false; error: string };
type ChildEditors = { nested?: BodyFieldModel; array?: BodyArrayModel };
export type BodyArrayModel =
  | {
      available: true;
      value: ArrayBodyValue;
      schema: Schema;
      items: (ChildEditors & { value: JsonValueNode; schema: Schema })[];
    }
  | Unavailable;
export type BodyFieldModel =
  | {
      available: true;
      value: ObjectBodyValue;
      fields: (ChildEditors & { name: string; schema: Schema })[];
      required: unknown[];
    }
  | Unavailable;
const object = (value: unknown): Schema =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Schema)
    : {};
const complex = (schema: Schema) =>
  Boolean(
    schema.$ref ||
    schema.allOf ||
    schema.oneOf ||
    schema.anyOf ||
    schema.if ||
    schema.then ||
    schema.else ||
    schema.not,
  );
/** A shared render budget bounds nested controls independently of the JSON parser. */
export function bodyFieldModel(
  body: string,
  schema: Schema,
  schemas: Record<string, Schema>,
  legacy: boolean,
): BodyFieldModel | BodyArrayModel {
  const budget = { remaining: 100 };
  const resolved = (schema: Schema, sensitive = false): Schema => ({
    ...resolveSchema(schema, schemas, { ignoreReferenceSiblings: legacy }),
    ...(!legacy ? { nullable: false } : {}),
    ...(sensitive ? { writeOnly: true } : {}),
  });
  function children(
    value: JsonValueNode | undefined,
    schema: Schema,
    depth: number,
    sensitive: boolean,
  ): ChildEditors {
    if (Object.hasOwn(schema, 'const') || Array.isArray(schema.enum)) return {};
    if (value?.kind === 'object')
      return { nested: build(value, schema, depth, sensitive) };
    if (value?.kind === 'array')
      return { array: buildArray(value, schema, depth, sensitive) };
    return {};
  }
  function buildArray(
    value: ArrayBodyValue,
    schema: Schema,
    depth: number,
    sensitive: boolean,
  ): BodyArrayModel {
    try {
      if (depth >= 8)
        throw new Error(
          'Use JSON for arrays beyond eight field-editor levels.',
        );
      const actual = resolved(schema, sensitive);
      const types = Array.isArray(actual.type)
        ? actual.type.filter((type) => type !== 'null')
        : actual.type
          ? [actual.type]
          : [];
      if (types.length && (types.length !== 1 || types[0] !== 'array'))
        throw new Error('Use JSON for ambiguous array type unions.');
      if (
        complex(actual) ||
        Object.hasOwn(actual, 'const') ||
        Array.isArray(actual.enum) ||
        actual.prefixItems ||
        Array.isArray(actual.items) ||
        actual.items === false ||
        actual.contains !== undefined ||
        actual.unevaluatedItems !== undefined ||
        actual.additionalItems !== undefined
      )
        throw new Error(
          'Use JSON for tuple, composed or conditional array schemas.',
        );
      if (value.items.length > MAX_ARRAY_ITEMS)
        throw new Error('Use JSON for arrays with more than 50 items.');
      if (value.items.length > budget.remaining)
        throw new Error('Use JSON when nested editing exceeds 100 controls.');
      budget.remaining -= value.items.length;
      const itemSchema = resolved(
        object(actual.items),
        actual.writeOnly === true,
      );
      return {
        available: true,
        value,
        schema: itemSchema,
        items: value.items.map((value) => ({
          value,
          schema: itemSchema,
          ...children(
            value,
            itemSchema,
            depth + 1,
            itemSchema.writeOnly === true,
          ),
        })),
      };
    } catch (error) {
      return {
        available: false,
        error:
          error instanceof Error ? error.message : 'Use JSON for this array.',
      };
    }
  }

  function build(
    value: JsonValueNode,
    schema: Schema,
    depth: number,
    sensitive = false,
  ): BodyFieldModel {
    try {
      if (value.kind !== 'object')
        throw new Error('Use JSON to edit scalar request bodies.');
      if (depth >= 8)
        throw new Error(
          'Use JSON for objects beyond eight field-editor levels.',
        );
      const actual = resolveSchema(schema, schemas, {
        ignoreReferenceSiblings: legacy,
      });
      if (complex(actual))
        throw new Error(
          'Use JSON for composed or conditional request schemas.',
        );
      const types = Array.isArray(actual.type)
        ? actual.type.filter((type) => type !== 'null')
        : actual.type
          ? [actual.type]
          : [];
      if (types.length && (types.length !== 1 || types[0] !== 'object'))
        throw new Error('Field editing requires an object request schema.');
      sensitive = sensitive || actual.writeOnly === true;
      const properties = Object.entries(object(actual.properties));
      if (properties.length > 100)
        throw new Error(
          'Use JSON for requests with more than 100 declared fields.',
        );
      const fields = properties
        .filter(([, property]) => property !== false)
        .map(([name, property]): { name: string; schema: Schema } => {
          return { name, schema: resolved(object(property), sensitive) };
        })
        .filter((field) => field.schema.readOnly !== true);
      if (!fields.length)
        throw new Error('No editable fields are defined. Use JSON.');
      if (fields.length > budget.remaining)
        throw new Error('Use JSON when nested editing exceeds 100 controls.');
      budget.remaining -= fields.length;
      return {
        available: true,
        value,
        required: Array.isArray(actual.required) ? actual.required : [],
        fields: fields.map((field) => {
          const child = value.entries.find(([key]) => key === field.name)?.[1];
          return {
            ...field,
            ...children(
              child,
              field.schema,
              depth + 1,
              sensitive || field.schema.writeOnly === true,
            ),
          };
        }),
      };
    } catch (error) {
      return {
        available: false,
        error:
          error instanceof Error
            ? error.message
            : 'Use the JSON editor for this body.',
      };
    }
  }
  try {
    const value = parseJsonValue(body);
    return value.kind === 'array'
      ? buildArray(value, schema, 0, false)
      : build(value, schema, 0);
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Use JSON for this body.',
    };
  }
}
/** Dot/bracket labels keep literal dots and nested paths distinct. */
export function bodyFieldLabel(path: readonly (string | number)[]): string {
  return path
    .map((part, index) =>
      typeof part === 'number'
        ? '[' + part + ']'
        : /^[a-zA-Z_$][\w$]*$/.test(part)
          ? (index ? '.' : '') + part
          : '[' + JSON.stringify(part) + ']',
    )
    .join('');
}
