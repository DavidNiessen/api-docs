import { lifecycleReport } from './lifecycle.js';
import type { LifecycleEntry, SiteData } from './index.js';

/** Static declarations only: rendered artifacts never encode the build machine's clock. */
export type LifecycleRecord = Omit<
  LifecycleEntry,
  'status' | 'daysUntilSunset'
>;
export interface LifecycleGroup {
  apiId: string;
  title: string;
  version: string;
  total: number;
  href: string;
}
export interface LifecyclePage {
  total: number;
  matched: number;
  number: number;
  pages: number;
  groups: LifecycleGroup[];
  groupHref: string;
  entries: LifecycleRecord[];
  previous?: string;
  next?: string;
}
export interface LifecycleContext {
  total: number;
  current?: LifecycleRecord;
  page?: LifecyclePage;
}
const PAGE_SIZE = 50;
const cache = new WeakMap<SiteData, ReturnType<typeof inventory>>();
const pageHref = (root: string, number: number) =>
  number === 1 ? root : `${root}page/${number}/`;
function inventory(site: SiteData) {
  // Discard all date-derived fields; the explicit constant merely resolves replacements.
  const entries: LifecycleRecord[] = lifecycleReport(site, {
    asOf: '1970-01-01',
  }).entries.map(
    ({ status: _status, daysUntilSunset: _days, ...entry }) => entry,
  );
  const groups = new Map<
    string,
    { group: LifecycleGroup; entries: LifecycleRecord[] }
  >();
  for (const entry of entries) {
    const key = JSON.stringify([entry.apiId, entry.version]);
    let group = groups.get(key);
    if (!group) {
      if (groups.size >= 1000)
        throw new Error(
          'Lifecycle catalog exceeds 1000 API versions; split the project.',
        );
      group = {
        group: {
          apiId: entry.apiId,
          title: entry.apiTitle,
          version: entry.version,
          href: `/deprecations/api/${encodeURIComponent(entry.apiId)}/version/${encodeURIComponent(entry.version)}/`,
          total: 0,
        },
        entries: [],
      };
      groups.set(key, group);
    }
    group.entries.push(entry);
    group.group.total++;
  }
  const catalogs = new Map<string, LifecycleRecord[]>([
    ['/deprecations/', entries],
  ]);
  for (const { group, entries } of groups.values())
    catalogs.set(group.href, entries);
  const routes = new Map<string, { root: string; number: number }>();
  for (const [root, entries] of catalogs)
    for (
      let number = 1;
      number <= Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
      number++
    )
      routes.set(pageHref(root, number), { root, number });
  return {
    entries,
    groups: [...groups.values()].map(({ group }) => group),
    catalogs,
    routes,
    byHref: new Map(entries.map((entry) => [entry.href, entry])),
  };
}
function get(site: SiteData) {
  let value = cache.get(site);
  if (!value) {
    value = inventory(site);
    cache.set(site, value);
  }
  return value;
}
/** Call after graph transforms; a SiteData graph is immutable during rendering. */
export function lifecycleRoutes(site: SiteData): string[] {
  return [...get(site).routes.keys()];
}
export function lifecycleContext(
  site: SiteData,
  path: string,
): LifecycleContext {
  const data = get(site);
  const route = data.routes.get(path);
  const current = data.byHref.get(path);
  if (!route)
    return { total: data.entries.length, ...(current ? { current } : {}) };
  const entries = data.catalogs.get(route.root)!;
  const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  return {
    total: data.entries.length,
    page: {
      total: data.entries.length,
      matched: entries.length,
      number: route.number,
      pages,
      groups: data.groups,
      groupHref: route.root,
      entries: entries.slice(
        (route.number - 1) * PAGE_SIZE,
        route.number * PAGE_SIZE,
      ),
      ...(route.number > 1
        ? { previous: pageHref(route.root, route.number - 1) }
        : {}),
      ...(route.number < pages
        ? { next: pageHref(route.root, route.number + 1) }
        : {}),
    },
  };
}
