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
}
export interface Media {
  schema: Schema;
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
export interface Theme {
  accent: string;
  radius: number;
  font: string;
  codeTheme: 'dark' | 'light';
  density: 'comfortable' | 'compact';
}
export interface ProjectConfig {
  schemaVersion: 1;
  name: string;
  description: string;
  basePath: string;
  logo?: string;
  favicon?: string;
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
  pluginVersions?: { name: string; version: string }[];
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
  plugins: { name: string; version: string }[];
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
