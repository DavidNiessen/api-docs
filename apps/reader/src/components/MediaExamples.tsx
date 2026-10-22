import { useState } from 'react';
import {
  exampleChoices,
  formatExample,
  hasExternalExamples,
  isJsonMediaType,
} from '@api-docs/contracts';
import type { Media, Schema } from '@api-docs/contracts';
import { CodeBlock } from './CodeBlock.js';
export function MediaExamples({
  media,
  mediaType,
  schemas,
  title = 'Example response',
}: {
  media: Media;
  mediaType: string;
  schemas: Record<string, Schema>;
  title?: string;
}) {
  const choices = exampleChoices(media, schemas);
  const [selected, setSelected] = useState(choices[0]!.id);
  const example =
    choices.find((choice) => choice.id === selected) ?? choices[0]!;
  return (
    <>
      {(choices.length > 1 || choices[0]!.id.startsWith('named:')) && (
        <label className="example-selector">
          {title === 'Example response' ? 'Response example' : title}
          <select
            value={example.id}
            onChange={(event) => setSelected(event.target.value)}
          >
            {choices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {hasExternalExamples(media) && (
        <p className="example-note">
          External examples are not loaded. Local values are shown here.
        </p>
      )}
      <CodeBlock
        code={formatExample(example.value, mediaType)}
        title={example.id === 'generated' ? `${title} · generated` : title}
        language={
          isJsonMediaType(mediaType)
            ? 'json'
            : (mediaType.split('/').at(-1) ?? 'text')
        }
      />
    </>
  );
}
