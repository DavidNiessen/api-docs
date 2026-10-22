import { useMemo, useState } from 'react';
import type { Media, Schema } from '@api-docs/contracts';
import type { MultipartFiles } from '@api-docs/explorer';
import { multipartEditorModel } from '../multipart-input.js';
import { BodyEditor } from './BodyEditor.js';

export function MultipartBodyEditor({
  body,
  media,
  schemas,
  legacy,
  files,
  onFiles,
  onChange,
  onError,
}: {
  body: string;
  media: Media;
  schemas: Record<string, Schema>;
  legacy: boolean;
  files: MultipartFiles;
  onFiles: (files: MultipartFiles) => void;
  onChange: (value: string) => void;
  onError: (error: string) => void;
}) {
  const [revision, setRevision] = useState(() => new Map<string, number>());
  const model = useMemo(() => {
    try {
      return { value: multipartEditorModel(media, schemas, legacy) };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : 'Multipart fields are unavailable.',
      };
    }
  }, [media, schemas, legacy]);
  if (!model.value)
    return (
      <p className="preview-error" role="alert">
        {model.error}
      </p>
    );
  return (
    <div className="multipart-editor">
      <p className="subtle">
        Edit text values below and choose local files separately. Up to 100
        parts and 32 MiB including headers. Files are sent only when you choose
        Send request.
      </p>
      {model.value.files.map((field) => {
        const selected = Object.hasOwn(files, field.name)
          ? (files[field.name] ?? [])
          : [];
        return (
          <div className="multipart-file" key={field.name}>
            <label>
              <span>
                <code>{field.name}</code>
                <small>
                  {field.multiple ? 'multiple files' : 'file'}
                  {field.required ? ' · required' : ''}
                </small>
              </span>
              <input
                key={revision.get(field.name) ?? 0}
                type="file"
                aria-label={`Upload ${field.name}`}
                multiple={field.multiple}
                required={field.required}
                onChange={(event) =>
                  onFiles({
                    ...files,
                    [field.name]: Array.from(
                      event.target.files ?? [],
                      (file) => ({ filename: file.name, data: file }),
                    ),
                  })
                }
              />
            </label>
            {field.description && <p className="subtle">{field.description}</p>}
            {selected.length > 0 && (
              <div className="multipart-selection">
                <span>
                  {selected.length} selected ·{' '}
                  {selected
                    .reduce((total, file) => total + file.data.size, 0)
                    .toLocaleString('en-US')}{' '}
                  bytes
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onFiles({ ...files, [field.name]: [] });
                    setRevision((current) =>
                      new Map(current).set(
                        field.name,
                        (current.get(field.name) ?? 0) + 1,
                      ),
                    );
                  }}
                >
                  Clear {field.name}
                </button>
              </div>
            )}
          </div>
        );
      })}
      <BodyEditor
        body={body}
        schema={model.value.textSchema}
        schemas={schemas}
        legacy={legacy}
        initialMode="fields"
        onChange={onChange}
        onError={onError}
      />
    </div>
  );
}
