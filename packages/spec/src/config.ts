import { z } from 'zod';
import type { ProjectConfig } from '@api-docs/contracts';

const safePath = z
  .string()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/)
  .refine(
    (value) => !value.split('/').includes('..'),
    'Parent traversal is not allowed',
  );
export const configSchema = z
  .object({
    schemaVersion: z.literal(1).default(1),
    name: z.string().min(1).max(100),
    description: z
      .string()
      .max(500)
      .default('Beautiful documentation for your API.'),
    basePath: z
      .string()
      .default('')
      .refine(
        (value) =>
          value === '' ||
          (/^\/[a-zA-Z0-9][a-zA-Z0-9/_-]*$/.test(value) &&
            !value.endsWith('/')),
        'Use an empty base path or /path without a trailing slash',
      ),
    logo: z.string().optional(),
    favicon: z.string().optional(),
    specs: z
      .array(
        z.object({
          id: safePath.refine(
            (value) => !value.includes('/'),
            'API id cannot contain /',
          ),
          path: safePath,
          version: z
            .string()
            .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/)
            .optional(),
        }),
      )
      .min(1),
    guides: safePath.default('guides'),
    theme: z
      .object({
        accent: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .default('#16a076'),
        radius: z.number().min(0).max(24).default(10),
        font: z.enum(['system', 'sans', 'serif']).default('system'),
        codeTheme: z.enum(['dark', 'light']).default('dark'),
        density: z.enum(['comfortable', 'compact']).default('comfortable'),
      })
      .prefault({}),
    links: z
      .array(
        z.object({
          label: z.string().max(60),
          href: z
            .string()
            .refine(
              (value) => /^https:\/\//.test(value) || /^\/(?!\/)/.test(value),
              'Links must be HTTPS URLs or local absolute paths',
            ),
        }),
      )
      .default([]),
    redirects: z
      .record(
        z.string().regex(/^\/(?!\/)[a-zA-Z0-9/_-]*$/),
        z.string().regex(/^\/(?!\/)[a-zA-Z0-9/_-]*$/),
      )
      .prefault({}),
    locales: z
      .array(z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/))
      .default(['en']),
    defaultLocale: z.string().default('en'),
    plugins: z.array(safePath).default([]),
  })
  .strict()
  .superRefine((config, context) => {
    if (
      new Set(config.specs.map((spec) => spec.id + ':' + (spec.version ?? '')))
        .size !== config.specs.length
    )
      context.addIssue({ code: 'custom', message: 'Duplicate API id/version' });
    if (!config.locales.includes(config.defaultLocale))
      context.addIssue({
        code: 'custom',
        message: 'defaultLocale must be included in locales',
      });
  });
export function parseConfig(input: unknown): ProjectConfig {
  return configSchema.parse(input) as ProjectConfig;
}
