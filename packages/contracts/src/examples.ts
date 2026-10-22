import type { Media, Schema } from './index.js';
import { exampleFor } from './schema.js';
export interface ExampleChoice {
  id: string;
  label: string;
  value: unknown;
}
/** External example URLs are metadata, never implicit reader network requests. */
export function exampleChoices(
  value: {
    example?: unknown;
    examples?: Record<string, unknown>;
    schema: Schema;
  },
  schemas: Record<string, Schema> = {},
): ExampleChoice[] {
  const result: ExampleChoice[] = [];
  if (Object.hasOwn(value, 'example') && value.example !== undefined)
    result.push({ id: 'inline', label: 'Example', value: value.example });
  for (const [name, item] of Object.entries(value.examples ?? {})) {
    if (!item || typeof item !== 'object' || !Object.hasOwn(item, 'value'))
      continue;
    const example = item as Record<string, unknown>;
    if (example.value === undefined) continue;
    result.push({
      id: `named:${name}`,
      label: (typeof example.summary === 'string'
        ? example.summary
        : name
      ).slice(0, 120),
      value: example.value,
    });
  }
  return result.length
    ? result
    : [
        {
          id: 'generated',
          label: 'Generated example',
          value: exampleFor(value.schema, schemas),
        },
      ];
}
export const isJsonMediaType = (type: string): boolean =>
  /(?:\/|\+)json$/.test(type.split(';')[0]!.trim().toLowerCase());
export function formatExample(value: unknown, mediaType: string): string {
  return !isJsonMediaType(mediaType) && typeof value === 'string'
    ? value
    : (JSON.stringify(value, null, 2) ?? 'null');
}
export function hasExternalExamples(media: Media): boolean {
  return Object.values(media.examples ?? {}).some(
    (item) =>
      item !== null &&
      typeof item === 'object' &&
      Object.hasOwn(item, 'externalValue'),
  );
}
