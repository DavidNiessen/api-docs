import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  parseJsonValue,
  serializeJsonValue,
  setJsonProperty,
  resolveSchema,
} from '@api-docs/contracts';
import type { JsonValueNode, Schema } from '@api-docs/contracts';

const object = (value: unknown): Schema =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Schema)
    : {};
const typeOf = (schema: Schema) =>
  Array.isArray(schema.type)
    ? schema.type.find((value) => value !== 'null')
    : schema.type;
function seed(schema: Schema, nonNull = false): JsonValueNode {
  for (const key of ['const', 'default', 'example'])
    if (schema[key] !== undefined && !(nonNull && schema[key] === null))
      return parseJsonValue(JSON.stringify(schema[key]));
  if (Array.isArray(schema.enum)) {
    const options = schema.enum.filter((value) => !nonNull || value !== null);
    if (options.length) return parseJsonValue(JSON.stringify(options[0]));
  }
  switch (typeOf(schema)) {
    case 'string':
      return { kind: 'string', value: '' };
    case 'number':
    case 'integer':
      return { kind: 'number', text: '0' };
    case 'boolean':
      return { kind: 'boolean', value: false };
    case 'array':
      return { kind: 'array', items: [] };
    case 'object':
      return { kind: 'object', entries: [] };
    default:
      return schema.properties
        ? { kind: 'object', entries: [] }
        : { kind: 'null' };
  }
}

function FieldValue({
  name,
  schema,
  value,
  onChange,
  onError,
}: {
  name: string;
  schema: Schema;
  value: JsonValueNode;
  onChange: (value: JsonValueNode) => void;
  onError: (name: string, error: string) => void;
}) {
  const text = serializeJsonValue(value, true),
    id = useId();
  const [draft, setDraft] = useState(text),
    [error, setError] = useState('');
  const report = useRef(onError);
  report.current = onError;
  useEffect(() => {
    setDraft(text);
    setError('');
    report.current(name, '');
  }, [text, name]);
  useEffect(() => () => report.current(name, ''), [name]);
  const declared = typeOf(schema);
  const nullable =
    (Array.isArray(schema.type) && schema.type.includes('null')) ||
    (schema.nullable === true && typeof schema.type === 'string');
  const options =
    Array.isArray(schema.enum) && schema.enum.length <= 50
      ? schema.enum
      : undefined;
  const current = serializeJsonValue(value);
  if (Object.hasOwn(schema, 'const'))
    return (
      <p className="body-constant">
        Fixed value: <code>{JSON.stringify(schema.const)}</code>
      </p>
    );
  const commit = (input: string) => {
    setDraft(input);
    try {
      const parsed = parseJsonValue(input);
      const expected = declared === 'integer' ? 'number' : declared;
      if (
        expected &&
        parsed.kind !== expected &&
        !(nullable && parsed.kind === 'null')
      )
        throw new Error(`Enter a JSON ${String(expected)}.`);
      onChange(parsed);
      setError('');
      onError(name, '');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Enter a valid JSON value.';
      setError(message);
      onError(name, `${name}: ${message}`);
    }
  };
  return (
    <div className="body-value">
      {options ? (
        <label>
          Value
          <select
            aria-label={`Body ${name}`}
            value={current}
            onChange={(event) => {
              onChange(parseJsonValue(event.target.value));
            }}
          >
            {!options.some((option) => JSON.stringify(option) === current) && (
              <option value={current}>Current: {current}</option>
            )}
            {options.map((option, index) => (
              <option key={index} value={JSON.stringify(option)}>
                {JSON.stringify(option)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          {nullable && (
            <label className="body-checkbox">
              <input
                type="checkbox"
                aria-label={`Use null for body ${name}`}
                checked={value.kind === 'null'}
                onChange={(event) => {
                  try {
                    onChange(
                      event.target.checked
                        ? { kind: 'null' }
                        : seed(
                            { ...schema, nullable: false, type: declared },
                            true,
                          ),
                    );
                  } catch {
                    setError(
                      'This field cannot be initialized here. Use JSON.',
                    );
                    onError(name, 'Use JSON to initialize this field.');
                  }
                }}
              />
              Use null
            </label>
          )}
          {nullable && value.kind === 'null' ? (
            <code>null</code>
          ) : declared === 'string' ||
            (!declared && value.kind === 'string') ? (
            <label>
              Value
              <input
                aria-label={`Body ${name}`}
                type={
                  schema.format === 'password' || schema.writeOnly === true
                    ? 'password'
                    : 'text'
                }
                autoComplete="off"
                value={value.kind === 'string' ? value.value : current}
                onChange={(event) =>
                  onChange({ kind: 'string', value: event.target.value })
                }
              />
            </label>
          ) : declared === 'boolean' ||
            (!declared && value.kind === 'boolean') ? (
            <label>
              Value
              <select
                aria-label={`Body ${name}`}
                value={current}
                onChange={(event) =>
                  onChange({
                    kind: 'boolean',
                    value: event.target.value === 'true',
                  })
                }
              >
                <option value="false">false</option>
                <option value="true">true</option>
              </select>
            </label>
          ) : (
            <label>
              {declared === 'number' || declared === 'integer'
                ? 'Value'
                : 'JSON value'}
              <textarea
                aria-label={`Body ${name}`}
                aria-invalid={!!error}
                aria-describedby={error ? id : undefined}
                inputMode={
                  declared === 'number' || declared === 'integer'
                    ? 'decimal'
                    : 'text'
                }
                rows={declared === 'number' || declared === 'integer' ? 1 : 3}
                value={draft}
                spellCheck={false}
                onChange={(event) => commit(event.target.value)}
              />
            </label>
          )}
        </>
      )}
      {error && (
        <p id={id} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type BodyModel =
  | {
      available: true;
      value: Extract<JsonValueNode, { kind: 'object' }>;
      fields: { name: string; schema: Schema }[];
      required: unknown[];
    }
  | { available: false; error: string };

export function BodyEditor({
  body,
  schema,
  schemas,
  legacy,
  onChange,
  onError,
  initialMode = 'json',
}: {
  body: string;
  schema: Schema;
  schemas: Record<string, Schema>;
  legacy: boolean;
  onChange: (body: string) => void;
  onError: (error: string) => void;
  initialMode?: 'json' | 'fields';
}) {
  const [mode, setMode] = useState<'json' | 'fields'>(initialMode);
  const [editorError, setEditorError] = useState('');
  const errors = useRef(new Map<string, string>()),
    report = useRef(onError);
  report.current = onError;
  useEffect(() => () => report.current(''), []);
  const model = useMemo<BodyModel>(() => {
    try {
      const value = parseJsonValue(body);
      if (value.kind !== 'object')
        throw new Error('Use JSON to edit non-object request bodies.');
      const actual = resolveSchema(schema, schemas, {
        ignoreReferenceSiblings: legacy,
      });
      if (
        actual.$ref ||
        actual.allOf ||
        actual.oneOf ||
        actual.anyOf ||
        actual.if ||
        actual.then ||
        actual.else ||
        actual.not
      )
        throw new Error(
          'Use JSON for composed or conditional request schemas.',
        );
      if (
        actual.type &&
        !(
          actual.type === 'object' ||
          (Array.isArray(actual.type) && actual.type.includes('object'))
        )
      )
        throw new Error('Field editing requires an object request schema.');
      const properties = Object.entries(object(actual.properties));
      if (properties.length > 100)
        throw new Error(
          'Use JSON for requests with more than 100 declared fields.',
        );
      const fields = properties
        .filter(([, property]) => property !== false)
        .map(([name, property]) => {
          const field = resolveSchema(object(property), schemas, {
            ignoreReferenceSiblings: legacy,
          });
          // In 3.1 nullable is an annotation, not a null type.
          return {
            name,
            schema: legacy ? field : { ...field, nullable: false },
          };
        })
        .filter((field) => field.schema.readOnly !== true);
      if (!fields.length)
        throw new Error('No editable fields are defined. Use JSON.');
      return {
        available: true,
        value,
        fields,
        required: Array.isArray(actual.required) ? actual.required : [],
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
  }, [body, schema, schemas, legacy]);
  const available = model.available;
  const shownMode = available ? mode : 'json';
  useEffect(() => {
    if (!available) setMode('json');
  }, [available]);
  useEffect(() => {
    if (mode === 'json') {
      errors.current.clear();
      setEditorError('');
      report.current('');
    }
  }, [mode]);
  const fieldError = (name: string, error: string) => {
    if (error) errors.current.set(name, error);
    else errors.current.delete(name);
    onError(errors.current.values().next().value ?? '');
  };
  return (
    <div className="body-editor">
      <div
        className="body-editor-modes"
        role="group"
        aria-label="Request body editor"
      >
        <button
          type="button"
          aria-pressed={shownMode === 'json'}
          onClick={() => setMode('json')}
        >
          JSON
        </button>
        <button
          type="button"
          aria-pressed={shownMode === 'fields'}
          disabled={!available}
          onClick={() => setMode('fields')}
        >
          Fields
        </button>
      </div>
      {shownMode === 'json' || !available ? (
        <>
          <label>
            Request body
            <textarea
              aria-label="Request body"
              value={body}
              spellCheck={false}
              rows={8}
              onChange={(event) => onChange(event.target.value)}
            />
          </label>
          {!available && <p className="subtle">{model.error}</p>}
        </>
      ) : (
        <fieldset className="body-fields">
          <legend>Request fields</legend>
          {editorError && <p role="alert">{editorError}</p>}
          <p className="subtle">
            Collections use JSON. Unknown and read-only values are retained;
            edit them in JSON. Required fields and schema constraints still
            apply.
          </p>
          {model.fields.map(({ name, schema: field }) => {
            const value = model.value.entries.find(
              ([key]) => key === name,
            )?.[1];
            const update = (node: JsonValueNode | undefined) =>
              onChange(
                serializeJsonValue(
                  setJsonProperty(model.value, name, node),
                  true,
                ),
              );
            return (
              <div className="body-field" key={name}>
                <div className="body-field-heading">
                  <label className="body-checkbox">
                    <input
                      type="checkbox"
                      aria-label={`Include body ${name}`}
                      checked={!!value}
                      onChange={(event) => {
                        try {
                          update(
                            event.target.checked ? seed(field) : undefined,
                          );
                          setEditorError('');
                          fieldError(name, '');
                        } catch {
                          setEditorError(
                            'This field cannot be initialized here. Edit it in JSON.',
                          );
                          fieldError(
                            name,
                            'Use JSON to initialize this field.',
                          );
                        }
                      }}
                    />
                    <code>{name}</code>
                  </label>
                  <small>
                    {String(typeOf(field) ?? 'JSON')}
                    {model.required.includes(name) ? ' · required' : ''}
                  </small>
                </div>
                {typeof field.description === 'string' && (
                  <p className="subtle">{field.description}</p>
                )}
                {value && (
                  <FieldValue
                    name={name}
                    schema={field}
                    value={value}
                    onChange={update}
                    onError={fieldError}
                  />
                )}
              </div>
            );
          })}
          {errors.current.size > 0 && (
            <p className="subtle">
              Fix incomplete field values before sending, or return to JSON to
              use the last valid values.
            </p>
          )}
        </fieldset>
      )}
    </div>
  );
}
