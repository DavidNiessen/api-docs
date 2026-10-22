import { operationHref } from './index.js';
import type {
  Operation,
  OperationKind,
  OperationLifecycle,
  SiteData,
  ApiDocument,
} from './index.js';

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000'))
    return false;
  const time = Date.parse(value + 'T00:00:00Z');
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
  );
}
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const plain = (value: unknown, maximum: number): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.length <= maximum &&
  !Array.from(value).some(
    (char) => char.codePointAt(0)! < 32 || char.codePointAt(0) === 127,
  );
/** Shared by the source loader and plugin boundary without coupling the SDK to the compiler. */
export function lifecycleIssues(value: unknown): string[] {
  if (!object(value)) return ['Lifecycle metadata must be an object'];
  const issues: string[] = [];
  if (!Object.keys(value).length)
    issues.push('Declare at least one lifecycle field');
  if (
    Object.keys(value).some(
      (key) =>
        ![
          'deprecatedOn',
          'sunsetOn',
          'migrationUrl',
          'message',
          'replacement',
        ].includes(key),
    )
  )
    issues.push('Unknown lifecycle field');
  for (const key of ['deprecatedOn', 'sunsetOn'])
    if (
      value[key] !== undefined &&
      (typeof value[key] !== 'string' || !isCalendarDate(value[key]))
    )
      issues.push(`${key} must be a real YYYY-MM-DD date`);
  if (
    typeof value.deprecatedOn === 'string' &&
    typeof value.sunsetOn === 'string' &&
    value.deprecatedOn > value.sunsetOn
  )
    issues.push('The sunset date cannot precede deprecation');
  if (value.message !== undefined && !plain(value.message, 2000))
    issues.push('message must be single-line text of at most 2000 characters');
  if (value.migrationUrl !== undefined) {
    let valid = plain(value.migrationUrl, 4096);
    if (valid) {
      const text = value.migrationUrl as string;
      try {
        const local = text.startsWith('/') && !text.startsWith('//');
        const url = new URL(text, 'https://docs.invalid');
        valid =
          !text.includes('\\') &&
          (local || /^https?:\/\//i.test(text)) &&
          ['https:', 'http:'].includes(url.protocol) &&
          !url.username &&
          !url.password &&
          (!local || url.origin === 'https://docs.invalid');
      } catch {
        valid = false;
      }
    }
    if (!valid)
      issues.push(
        'migrationUrl must be an HTTP(S) URL without credentials or a site-relative route',
      );
  }
  if (value.replacement !== undefined) {
    const target = value.replacement;
    if (!object(target)) issues.push('replacement must be an object');
    else {
      if (
        Object.keys(target).some(
          (key) => !['apiId', 'version', 'kind', 'operationId'].includes(key),
        )
      )
        issues.push('Unknown replacement field');
      if (!plain(target.operationId, 1024))
        issues.push(
          'replacement.operationId is required and must be at most 1024 characters',
        );
      for (const key of ['apiId', 'version'])
        if (target[key] !== undefined && !plain(target[key], 128))
          issues.push(`replacement.${key} must be at most 128 characters`);
      if (
        target.kind !== undefined &&
        (typeof target.kind !== 'string' ||
          !['endpoint', 'webhook', 'callback'].includes(target.kind))
      )
        issues.push('replacement.kind must be endpoint, webhook or callback');
    }
  }
  return issues;
}
export function parseOperationLifecycle(value: unknown): OperationLifecycle {
  const issues = lifecycleIssues(value);
  if (issues.length)
    throw new Error(`Invalid lifecycle metadata: ${issues.join('; ')}`);
  const input = value as OperationLifecycle;
  return {
    ...(input.deprecatedOn === undefined
      ? {}
      : { deprecatedOn: input.deprecatedOn }),
    ...(input.sunsetOn === undefined ? {} : { sunsetOn: input.sunsetOn }),
    ...(input.migrationUrl === undefined
      ? {}
      : { migrationUrl: input.migrationUrl }),
    ...(input.message === undefined ? {} : { message: input.message }),
    ...(input.replacement === undefined
      ? {}
      : {
          replacement: {
            operationId: input.replacement.operationId,
            ...(input.replacement.apiId === undefined
              ? {}
              : { apiId: input.replacement.apiId }),
            ...(input.replacement.version === undefined
              ? {}
              : { version: input.replacement.version }),
            ...(input.replacement.kind === undefined
              ? {}
              : { kind: input.replacement.kind }),
          },
        }),
  };
}
export type LifecycleStatus =
  'sunset-reached' | 'sunset-soon' | 'deprecated' | 'planned';
export interface LifecycleEntry {
  apiId: string;
  apiTitle: string;
  version: string;
  operationId: string;
  kind: OperationKind;
  method: string;
  path: string;
  summary: string;
  href: string;
  source: string;
  deprecated: boolean;
  lifecycle: OperationLifecycle;
  status: LifecycleStatus;
  daysUntilSunset?: number;
  replacementHref?: string;
  replacementIssue?: 'missing' | 'ambiguous' | 'self';
}
export interface LifecycleReport {
  asOf: string;
  windowDays: number;
  total: number;
  counts: Record<LifecycleStatus, number>;
  entries: LifecycleEntry[];
}
const identity = (
  apiId: string,
  version: string,
  kind: OperationKind,
  id: string,
) => JSON.stringify([apiId, version, kind, id]);
/** Clock use is explicit here; build/normalization code never derives time-sensitive metadata. */
export function lifecycleReport(
  site: SiteData,
  options: {
    asOf: string;
    windowDays?: number;
    apiId?: string | undefined;
    apiVersion?: string | undefined;
  },
): LifecycleReport {
  if (!isCalendarDate(options.asOf))
    throw new Error(
      'Use a real calendar date in YYYY-MM-DD format for --as-of.',
    );
  const windowDays = options.windowDays ?? 30;
  if (!Number.isInteger(windowDays) || windowDays < 0 || windowDays > 36_500)
    throw new Error('The lifecycle window must be 0–36500 days.');
  const apis = site.apis.filter(
    (api) =>
      (!options.apiId || api.id === options.apiId) &&
      (!options.apiVersion || api.version === options.apiVersion),
  );
  if ((options.apiId || options.apiVersion) && !apis.length)
    throw new Error('No API matches the lifecycle filters.');
  const lookup = new Map<
    string,
    { api: ApiDocument; operation: Operation }[]
  >();
  let visited = 0;
  for (const api of site.apis)
    for (const operation of api.operations) {
      if (++visited > 100_000)
        throw new Error(
          'Lifecycle inventory exceeds 100,000 operations; split the project.',
        );
      const key = identity(
        api.id,
        api.version,
        operation.kind ?? 'endpoint',
        operation.id,
      );
      const values = lookup.get(key) ?? [];
      values.push({ api, operation });
      lookup.set(key, values);
    }
  const today = Date.parse(options.asOf + 'T00:00:00Z');
  const entries: LifecycleEntry[] = [];
  const counts: LifecycleReport['counts'] = {
    'sunset-reached': 0,
    'sunset-soon': 0,
    deprecated: 0,
    planned: 0,
  };
  for (const api of apis)
    for (const operation of api.operations) {
      if (!operation.deprecated && !operation.lifecycle) continue;
      const lifecycle = operation.lifecycle
        ? parseOperationLifecycle(operation.lifecycle)
        : {};
      const days =
        lifecycle.sunsetOn === undefined
          ? undefined
          : Math.floor(
              (Date.parse(lifecycle.sunsetOn + 'T00:00:00Z') - today) /
                86_400_000,
            );
      const status: LifecycleStatus =
        days !== undefined && days <= 0
          ? 'sunset-reached'
          : days !== undefined && days <= windowDays
            ? 'sunset-soon'
            : operation.deprecated ||
                (lifecycle.deprecatedOn !== undefined &&
                  lifecycle.deprecatedOn <= options.asOf)
              ? 'deprecated'
              : 'planned';
      const entry: LifecycleEntry = {
        apiId: api.id,
        apiTitle: api.title,
        version: api.version,
        operationId: operation.id,
        kind: operation.kind ?? 'endpoint',
        method: operation.method.toUpperCase(),
        path: operation.path,
        summary: operation.summary,
        href: operationHref(api, operation),
        source: operation.source,
        deprecated: operation.deprecated,
        lifecycle,
        status,
        ...(days === undefined ? {} : { daysUntilSunset: days }),
      };
      if (lifecycle.replacement) {
        const target = lifecycle.replacement;
        const matches =
          lookup.get(
            identity(
              target.apiId ?? api.id,
              target.version ?? api.version,
              target.kind ?? entry.kind,
              target.operationId,
            ),
          ) ?? [];
        if (!matches.length) entry.replacementIssue = 'missing';
        else if (matches.length > 1) entry.replacementIssue = 'ambiguous';
        else if (matches[0]!.operation === operation)
          entry.replacementIssue = 'self';
        else
          entry.replacementHref = operationHref(
            matches[0]!.api,
            matches[0]!.operation,
          );
      }
      counts[status]++;
      entries.push(entry);
    }
  const key = (entry: LifecycleEntry) =>
    JSON.stringify([entry.apiId, entry.version, entry.href]);
  entries.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  return {
    asOf: options.asOf,
    windowDays,
    total: entries.length,
    counts,
    entries,
  };
}
