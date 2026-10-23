import { useId } from 'react';
import type { Parameter } from '@api-docs/contracts';

export function ParameterInput({
  parameter,
  value,
  presence,
  allowEmpty,
  qualified,
  onChange,
  onPresence,
}: {
  parameter: Parameter;
  value: string;
  presence: boolean | undefined;
  allowEmpty: boolean;
  qualified: boolean;
  onChange: (value: string) => void;
  onPresence: (value: boolean | undefined) => void;
}) {
  const id = useId();
  const included = presence ?? value !== '';
  const hint =
    !parameter.required && !included && value
      ? 'Omitted; entered text is kept as a draft.'
      : included && value === ''
        ? 'Sends an empty value. The API still validates the value.'
        : '';
  return (
    <div className="parameter-input">
      <label htmlFor={id}>
        <span>
          <code>{parameter.name}</code>
          <small>
            {parameter.in}
            {parameter.required ? ' · required' : ''}
          </small>
        </span>
        <input
          id={id}
          aria-label={`${parameter.name}${qualified ? ' ' + parameter.in : ''} parameter`}
          aria-describedby={hint ? id + '-presence' : undefined}
          value={value}
          placeholder={
            parameter.schema.type === 'array'
              ? '["value"]'
              : parameter.schema.type === 'object'
                ? '{"key":"value"}'
                : 'Enter a value'
          }
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      {(!parameter.required || allowEmpty) && (
        <label className="parameter-presence">
          <input
            type="checkbox"
            aria-label={`${parameter.required ? 'Allow empty value' : 'Include in request'}: ${parameter.in} ${parameter.name}`}
            checked={parameter.required ? presence === true : included}
            onChange={(event) =>
              onPresence(
                parameter.required && !event.target.checked
                  ? undefined
                  : event.target.checked,
              )
            }
          />
          <span>
            {parameter.required ? 'Allow empty value' : 'Include in request'}
          </span>
        </label>
      )}
      {hint && (
        <p id={id + '-presence'} className="parameter-presence-hint">
          {hint}
        </p>
      )}
    </div>
  );
}
