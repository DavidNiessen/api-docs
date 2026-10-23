export type HttpMethod =
  'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options' | 'trace';
export type Json =
  null | boolean | number | string | Json[] | { [key: string]: Json };
export type Schema = Record<string, unknown>;
export interface Diagnostic {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  source?: string;
}
export interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  description: string;
  schema: Schema;
  style?: string;
  explode?: boolean;
  example?: unknown;
  examples?: Record<string, unknown>;
  content?: Record<string, Media>;
  allowReserved?: boolean;
  deprecated?: boolean;
}
export interface Media {
  schema: Schema;
  encoding?: Record<string, unknown>;
  example?: unknown;
  examples?: Record<string, unknown>;
}
export interface ApiResponse {
  status: string;
  description: string;
  content: Record<string, Media>;
  headers: Record<string, unknown>;
}
export type OperationKind = 'endpoint' | 'webhook' | 'callback';
export interface OperationLifecycle {
  deprecatedOn?: string;
  sunsetOn?: string;
  migrationUrl?: string;
  message?: string;
  replacement?: {
    apiId?: string;
    version?: string;
    kind?: OperationKind;
    operationId: string;
  };
}
export interface Operation {
  codeSamples?: CodeSample[];
  kind?: OperationKind;
  lifecycle?: OperationLifecycle;
  callback?: { operationId: string; name: string; expression: string };
  externalDocs?: { url: string; description?: string };
  id: string;
  slug: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  tags: string[];
  deprecated: boolean;
  parameters: Parameter[];
  requestBody?: {
    required: boolean;
    description: string;
    content: Record<string, Media>;
  };
  responses: ApiResponse[];
  security: Record<string, string[]>[];
  servers: string[];
  source: string;
}
/** Reviewed static build output, independent of live playground inputs. */
export interface CodeSample {
  plugin: string;
  id: string;
  label: string;
  language: string;
  code: string;
}
export interface SecurityScheme {
  type: string;
  description?: string;
  scheme?: string;
  name?: string;
  in?: string;
  flows?: Record<string, unknown>;
  openIdConnectUrl?: string;
}
export interface ApiDocument {
  openapiVersion?: string;
  id: string;
  version: string;
  title: string;
  description: string;
  source: string;
  operations: Operation[];
  schemas: Record<string, Schema>;
  securitySchemes: Record<string, SecurityScheme>;
  diagnostics: Diagnostic[];
  servers: string[];
}
export interface Guide {
  links?: { url: string; kind: 'link' | 'image' }[];
  anchors?: string[];
  sourceBytes?: number;
  order: number;
  slug: string;
  title: string;
  description: string;
  group: string;
  html: string;
  text: string;
  headings: { id: string; text: string; level: number }[];
  source: string;
}
export interface Palette {
  background: string;
  surface: string;
  subtle: string;
  border: string;
  text: string;
  muted: string;
  heading: string;
}
export interface Theme {
  preset?: 'mint' | 'ocean' | 'violet' | 'neutral';
  colors?: { light?: Partial<Palette>; dark?: Partial<Palette> };
  sidebarWidth?: number;
  contentWidth?: number;
  stylesheet?: string;
  accent: string;
  radius: number;
  font: string;
  codeTheme: 'dark' | 'light';
  density: 'comfortable' | 'compact';
}
export interface ProjectConfig {
  explorer?: {
    credentialReuse?: boolean;
    oauthClients?: Record<
      string,
      Record<string, { clientId: string; issuer: string }>
    >;
  };
  doctor?: {
    rules: Record<string, 'off' | 'warning' | 'error'>;
    suppressions: { code: string; source: string; reason: string }[];
  };
  schemaVersion: 1;
  name: string;
  description: string;
  basePath: string;
  logo?: string;
  logoDark?: string;
  favicon?: string;
  assets?: string;
  siteUrl?: string;
  seo?: { index: boolean; socialImage?: string };
  specs: { id: string; path: string; version?: string }[];
  guides: string;
  theme: Theme;
  links: { label: string; href: string }[];
  redirects: Record<string, string>;
  locales: string[];
  defaultLocale: string;
  plugins: string[];
}
export interface SiteData {
  /** Route-scoped render data; absent from the compiler's full graph. */
  pagePath?: string;
  lifecycle?: import('./lifecycle-pages.js').LifecycleContext;
  assetMetadata?: { path: string; hash: string }[];
  navigationTotal?: number;
  navigationTruncated?: boolean;
  pluginVersions?: {
    name: string;
    version: string;
    sourceDigest?: string;
    inputs?: { path: string; digest: string }[];
  }[];
  schemaVersion: 1;
  config: ProjectConfig;
  apis: ApiDocument[];
  guides: Guide[];
  diagnostics: Diagnostic[];
}
export interface SearchDocument {
  id: string;
  title: string;
  text: string;
  href: string;
  group: string;
  kind: 'guide' | 'operation';
  method?: HttpMethod;
  version?: string;
}
export interface SearchResult extends SearchDocument {
  score: number;
  excerpt: string;
}
export interface ArtifactManifest {
  artifactDigest: string;
  schemaVersion: 1 | 2;
  compilerVersion: string;
  inputDigest: string;
  files: Record<string, string>;
  routes: string[];
  diagnostics: Diagnostic[];
  plugins: NonNullable<SiteData['pluginVersions']>;
}

export const methods: HttpMethod[] = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
  'trace',
];
export function slugify(value: string): string {
  return (
    value
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'page'
  );
}
export function operationHref(api: ApiDocument, operation: Operation): string {
  return `/api/${encodeURIComponent(api.id)}/${encodeURIComponent(api.version)}/${operation.slug}/`;
}
export function guideHref(guide: Guide): string {
  return `/guides/${guide.slug}/`;
}
export function withBase(base: string, path: string): string {
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export { resolveSchema, exampleFor } from './schema.js';

export { createPageData, normalizePagePath } from './page.js';
export { toolVersion } from './version.js';
export { lifecycleContext, lifecycleRoutes } from './lifecycle-pages.js';
export type {
  LifecycleContext,
  LifecycleGroup,
  LifecyclePage,
  LifecycleRecord,
} from './lifecycle-pages.js';

export {
  contrastRatio,
  readableAccent,
  resolvePalette,
  themePresets,
} from './theme.js';

export { pageMetadata } from './metadata.js';
export {
  exampleChoices,
  formatExample,
  isJsonMediaType,
  hasExternalExamples,
} from './examples.js';
export type { ExampleChoice } from './examples.js';
export { parseJsonValue, serializeJsonValue, setJsonProperty } from './json.js';
export type { JsonValueNode } from './json.js';
export {
  isCalendarDate,
  lifecycleIssues,
  parseOperationLifecycle,
  lifecycleReport,
} from './lifecycle.js';
export type {
  LifecycleEntry,
  LifecycleReport,
  LifecycleStatus,
} from './lifecycle.js';
