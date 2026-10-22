import { resolveSchema } from '@api-docs/contracts';
import type { Schema } from '@api-docs/contracts';
const object = (value: unknown): Schema =>
  value !== null && typeof value === 'object' ? (value as Schema) : {};
function typeLabel(schema: Schema): string {
  if (schema.$ref) return String(schema.$ref).split('/').pop() ?? 'reference';
  if (schema.oneOf) return 'one of';
  if (schema.anyOf) return 'any of';
  if (schema.allOf) return 'all of';
  return Array.isArray(schema.type)
    ? schema.type.join(' | ')
    : String(schema.type ?? (schema.properties ? 'object' : 'any'));
}
export function SchemaView({
  schema,
  schemas,
  depth = 0,
  visited = new Set<string>(),
}: {
  schema: Schema;
  schemas: Record<string, Schema>;
  depth?: number;
  visited?: Set<string>;
}) {
  const ref = typeof schema.$ref === 'string' ? schema.$ref : '';
  if (depth > 6 || (ref && visited.has(ref)))
    return (
      <p className="schema-recursive">
        Recursive reference: <code>{ref.split('/').pop() ?? 'schema'}</code>
      </p>
    );
  const next = new Set(visited);
  if (ref) next.add(ref);
  const actual = resolveSchema(schema, schemas);
  const required = Array.isArray(actual.required) ? actual.required : [];
  const properties = Object.entries(object(actual.properties));
  const variants = ['oneOf', 'anyOf', 'allOf'].find((key) =>
    Array.isArray(actual[key]),
  );
  if (variants)
    return (
      <div className="schema-variants">
        <small>{variants}</small>
        {(actual[variants] as Schema[]).map((variant, index) => (
          <details key={index} open={index === 0}>
            <summary>
              Variant {index + 1}{' '}
              <span className="type-label">{typeLabel(variant)}</span>
            </summary>
            <SchemaView
              schema={variant}
              schemas={schemas}
              depth={depth + 1}
              visited={next}
            />
          </details>
        ))}
      </div>
    );
  if (actual.type === 'array')
    return (
      <div className="schema-array">
        <span className="type-label">
          array of {typeLabel(object(actual.items))}
        </span>
        <SchemaView
          schema={object(actual.items)}
          schemas={schemas}
          depth={depth + 1}
          visited={next}
        />
      </div>
    );
  if (!properties.length)
    return (
      <div className="schema-leaf">
        <span className="type-label">
          {typeLabel(actual)}
          {actual.format ? ` · ${String(actual.format)}` : ''}
        </span>
        {actual.description ? <p>{String(actual.description)}</p> : null}
        {Array.isArray(actual.enum) && (
          <p>
            Allowed values:{' '}
            {actual.enum.map((value) => (
              <code key={String(value)}>{String(value)}</code>
            ))}
          </p>
        )}
        {['minimum', 'maximum', 'minLength', 'maxLength', 'pattern', 'default']
          .filter((key) => actual[key] !== undefined)
          .map((key) => (
            <small key={key}>
              {key}: {JSON.stringify(actual[key])}{' '}
            </small>
          ))}
      </div>
    );
  return (
    <div className="schema-fields">
      {properties.map(([name, value]) => {
        const property = object(value);
        const resolved = resolveSchema(property, schemas);
        const nested =
          property.$ref ||
          resolved.properties ||
          resolved.items ||
          resolved.oneOf ||
          resolved.allOf ||
          resolved.anyOf;
        return (
          <div className="schema-field" key={name}>
            <div className="field-heading">
              <code>{name}</code>
              <span className="type-label">{typeLabel(property)}</span>
              {required.includes(name) && (
                <span className="required">required</span>
              )}
              {property.deprecated === true && (
                <span className="deprecated-label">deprecated</span>
              )}
            </div>
            {property.description ? (
              <p>{String(property.description)}</p>
            ) : null}
            {nested ? (
              <details>
                <summary>Show child attributes</summary>
                <SchemaView
                  schema={property}
                  schemas={schemas}
                  depth={depth + 1}
                  visited={next}
                />
              </details>
            ) : (
              <SchemaView
                schema={{ ...property, description: '' }}
                schemas={schemas}
                depth={depth + 1}
                visited={next}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
