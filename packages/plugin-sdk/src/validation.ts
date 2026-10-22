import { z } from 'zod';
import type { SiteData } from '@api-docs/contracts';
const text = z.string().max(2 * 1024 * 1024);
const name = z.string().min(1).max(1024);
const object = z.record(z.string(), z.unknown());
const media = z
  .object({
    schema: object,
    encoding: object.optional(),
    example: z.unknown().optional(),
    examples: object.optional(),
  })
  .strict();
const content = z.record(z.string(), media);
const parameter = z
  .object({
    name,
    in: z.enum(['path', 'query', 'header', 'cookie']),
    required: z.boolean(),
    description: text,
    schema: object,
    style: z.string().optional(),
    explode: z.boolean().optional(),
    example: z.unknown().optional(),
    examples: object.optional(),
    content: content.optional(),
    allowReserved: z.boolean().optional(),
    deprecated: z.boolean().optional(),
  })
  .strict();
const operation = z
  .object({
    kind: z.enum(['endpoint', 'webhook', 'callback']).optional(),
    callback: z
      .object({ operationId: name, name, expression: name })
      .strict()
      .optional(),
    externalDocs: z
      .object({ url: text, description: text.optional() })
      .strict()
      .optional(),
    id: name,
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    method: z.enum([
      'get',
      'post',
      'put',
      'patch',
      'delete',
      'head',
      'options',
      'trace',
    ]),
    path: name,
    summary: text,
    description: text,
    tags: z.array(name).max(1000),
    deprecated: z.boolean(),
    parameters: z.array(parameter).max(1000),
    requestBody: z
      .object({ required: z.boolean(), description: text, content })
      .strict()
      .optional(),
    responses: z
      .array(
        z
          .object({
            status: z.string().regex(/^(?:[1-5](?:\d\d|XX)|default)$/),
            description: text,
            content,
            headers: object,
          })
          .strict(),
      )
      .max(1000),
    security: z.array(z.record(z.string(), z.array(z.string()))).max(1000),
    servers: z.array(text).max(1000),
    source: text,
  })
  .strict();
const schema = z
  .object({
    schemaVersion: z.literal(1),
    config: object,
    assetMetadata: z
      .array(
        z
          .object({ path: name, hash: z.string().regex(/^[a-f0-9]{64}$/) })
          .strict(),
      )
      .max(2000)
      .optional(),
    navigationTotal: z.number().int().nonnegative().optional(),
    navigationTruncated: z.boolean().optional(),
    pluginVersions: z.array(object).max(32).optional(),
    apis: z
      .array(
        z
          .object({
            openapiVersion: z.string().optional(),
            id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/),
            version: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/),
            title: text,
            description: text,
            source: text,
            operations: z.array(operation).max(100_000),
            schemas: z.record(z.string(), object),
            securitySchemes: z.record(z.string(), object),
            diagnostics: z
              .array(
                z
                  .object({
                    code: name,
                    severity: z.enum(['warning', 'error']),
                    message: text,
                    source: text.optional(),
                  })
                  .strict(),
              )
              .max(10_000),
            servers: z.array(text).max(1000),
          })
          .strict(),
      )
      .max(128),
    guides: z
      .array(
        z
          .object({
            sourceBytes: z
              .number()
              .int()
              .nonnegative()
              .max(2 * 1024 * 1024)
              .optional(),
            order: z.number().finite(),
            slug: z.string().regex(/^[a-z0-9]+(?:[-/][a-z0-9]+)*$/),
            title: name,
            description: text,
            group: name,
            html: text,
            text,
            source: text,
            headings: z
              .array(
                z
                  .object({
                    id: name,
                    text,
                    level: z.number().int().min(1).max(6),
                  })
                  .strict(),
              )
              .max(10_000),
          })
          .strict(),
      )
      .max(10_000),
    diagnostics: z
      .array(
        z
          .object({
            code: name,
            severity: z.enum(['warning', 'error']),
            message: text,
            source: text.optional(),
          })
          .strict(),
      )
      .max(10_000),
  })
  .strict();
/** Reject malformed graph data without reflecting plugin-controlled payloads in errors. */
export function validatePluginSite(value: unknown): SiteData {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new Error(
      'Invalid plugin output: graph fields do not match the supported data contract',
    );
  const site = result.data as unknown as SiteData;
  const identities = new Set<string>();
  for (const api of site.apis) {
    const key = `${api.id}:${api.version}`;
    if (identities.has(key))
      throw new Error('Invalid plugin output: duplicate API identity');
    identities.add(key);
    const slugs = new Set<string>(),
      ids = new Set<string>();
    for (const operation of api.operations) {
      if (slugs.has(operation.slug) || ids.has(operation.id))
        throw new Error('Invalid plugin output: duplicate operation identity');
      slugs.add(operation.slug);
      ids.add(operation.id);
      for (const requirement of operation.security)
        for (const name of Object.keys(requirement))
          if (!Object.hasOwn(api.securitySchemes, name))
            throw new Error('Invalid plugin output: undefined security scheme');
    }
  }
  if (
    new Set(site.guides.map((guide) => guide.slug)).size !== site.guides.length
  )
    throw new Error('Invalid plugin output: duplicate guide route');
  return site;
}
