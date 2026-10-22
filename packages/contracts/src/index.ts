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
export interface Operation {
  kind?: 'endpoint' | 'webhook' | 'callback';
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
  schemaVersion: 1;
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
