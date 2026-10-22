import { parseJsonValue, resolveSchema } from '@api-docs/contracts';
import type { JsonValueNode, Schema } from '@api-docs/contracts';

export type ObjectBodyValue = Extract<JsonValueNode, { kind: 'object' }>;
export type BodyFieldModel =
  | {
      available: true;
      value: ObjectBodyValue;
      fields: { name: string; schema: Schema; nested?: BodyFieldModel }[];
      required: unknown[];
    }
  | { available: false; error: string };
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
): BodyFieldModel {
  const budget = { remaining: 100 };
  function build(
    value: JsonValueNode,
    schema: Schema,
    depth: number,
    sensitive = false,
  ): BodyFieldModel {
    try {
      if (value.kind !== 'object')
        throw new Error('Use JSON to edit non-object request bodies.');
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
          const resolved = resolveSchema(object(property), schemas, {
            ignoreReferenceSiblings: legacy,
          });
          return {
            name,
            schema: {
              ...resolved,
              ...(!legacy ? { nullable: false } : {}),
              ...(sensitive ? { writeOnly: true } : {}),
            },
          };
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
            ...(child?.kind === 'object' &&
            !Object.hasOwn(field.schema, 'const') &&
            !Array.isArray(field.schema.enum)
              ? {
                  nested: build(
                    child,
                    field.schema,
                    depth + 1,
                    sensitive || field.schema.writeOnly === true,
                  ),
                }
              : {}),
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
    return build(parseJsonValue(body), schema, 0);
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Use JSON for this body.',
    };
  }
}
/** Dot/bracket labels keep literal dots and nested paths distinct. */
export function bodyFieldLabel(path: readonly string[]): string {
  return path
    .map((part, index) =>
      /^[a-zA-Z_$][\w$]*$/.test(part)
        ? (index ? '.' : '') + part
        : '[' + JSON.stringify(part) + ']',
    )
    .join('');
}
