import { useEffect, useState } from 'react';
import { withBase } from '@api-docs/contracts';
import type { LifecyclePage, LifecycleRecord } from '@api-docs/contracts';
import { Icon } from './Icon.js';

function useUtcDate() {
  const [date, setDate] = useState<string>();
  useEffect(() => {
    const update = () => setDate(new Date().toISOString().slice(0, 10));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, []);
  return date;
}
function status(entry: LifecycleRecord, date: string | undefined) {
  const { sunsetOn, deprecatedOn } = entry.lifecycle;
  if (date && sunsetOn) {
    const days =
      (Date.parse(sunsetOn + 'T00:00:00Z') - Date.parse(date + 'T00:00:00Z')) /
      86_400_000;
    if (days <= 0) return 'Sunset date reached';
    if (days <= 30) return 'Sunset within 30 days';
  }
  return entry.deprecated || (date && deprecatedOn && deprecatedOn <= date)
    ? 'Deprecated operation'
    : 'Lifecycle announcement';
}
function Guidance({
  entry,
  basePath,
}: {
  entry: LifecycleRecord;
  basePath: string;
}) {
  const migration = entry.lifecycle.migrationUrl;
  return (
    <>
      {entry.lifecycle.message && <p>{entry.lifecycle.message}</p>}
      {(entry.lifecycle.deprecatedOn || entry.lifecycle.sunsetOn) && (
        <dl className="lifecycle-dates">
          {entry.lifecycle.deprecatedOn && (
            <div>
              <dt>Deprecation</dt>
              <dd>
                <time dateTime={entry.lifecycle.deprecatedOn}>
                  {entry.lifecycle.deprecatedOn}
                </time>
              </dd>
            </div>
          )}
          {entry.lifecycle.sunsetOn && (
            <div>
              <dt>Sunset</dt>
              <dd>
                <time dateTime={entry.lifecycle.sunsetOn}>
                  {entry.lifecycle.sunsetOn}
                </time>
              </dd>
            </div>
          )}
        </dl>
      )}
      <div className="lifecycle-links">
        {entry.replacementHref && (
          <a href={withBase(basePath, entry.replacementHref)} data-doc-route>
            Replacement operation <Icon name="arrow" size={14} />
          </a>
        )}
        {migration && (
          <a
            href={
              migration.startsWith('/')
                ? withBase(basePath, migration)
                : migration
            }
            data-doc-route={migration.startsWith('/') ? true : undefined}
            rel={migration.startsWith('/') ? undefined : 'noreferrer'}
          >
            Migration guide{' '}
            <Icon
              name={migration.startsWith('/') ? 'arrow' : 'external'}
              size={14}
            />
          </a>
        )}
      </div>
      {entry.replacementIssue && (
        <p className="lifecycle-note">
          Replacement details are unavailable. Contact the API owner for
          migration guidance.
        </p>
      )}
    </>
  );
}
export function OperationLifecycle({
  entry,
  basePath,
}: {
  entry: LifecycleRecord;
  basePath: string;
}) {
  const date = useUtcDate();
  return (
    <aside
      className="callout warning lifecycle-notice"
      aria-label="Operation lifecycle"
    >
      <Icon name="info" />
      <div>
        <strong>{status(entry, date)}</strong>
        <Guidance entry={entry} basePath={basePath} />
        <a href={withBase(basePath, '/deprecations/')} data-doc-route>
          View all deprecations
        </a>
      </div>
    </aside>
  );
}
export function DeprecationCenter({
  page,
  basePath,
}: {
  page: LifecyclePage;
  basePath: string;
}) {
  const date = useUtcDate();
  const group = page.groups.find((group) => group.href === page.groupHref);
  return (
    <article className="article lifecycle-center">
      <div className="eyebrow">API lifecycle</div>
      <h1>Deprecations</h1>
      <p className="page-description">
        Plan your next migration. Find retirement dates, replacement operations
        and guidance across every published API version.
      </p>
      <p className="lifecycle-note">
        Dates begin at 00:00 UTC. A declared sunset does not confirm that an API
        has been shut down.
        {date
          ? ` Status as of ${date} (UTC).`
          : ' Calendar status is available with JavaScript; all declared dates are listed below.'}
      </p>
      <nav className="lifecycle-filters" aria-label="Filter deprecations">
        <a
          href={withBase(basePath, '/deprecations/')}
          data-doc-route
          aria-current={
            page.groupHref === '/deprecations/' ? 'page' : undefined
          }
        >
          All APIs <span>{page.total}</span>
        </a>
        {page.groups.length > 0 && (
          <details>
            <summary>
              {group
                ? `${group.title} · ${group.version}`
                : 'Choose API and version'}
            </summary>
            <div className="lifecycle-group-options">
              {page.groups.map((item) => (
                <a
                  key={item.href}
                  href={withBase(basePath, item.href)}
                  data-doc-route
                  aria-current={
                    item.href === page.groupHref ? 'page' : undefined
                  }
                >
                  {item.title} · {item.version} <span>{item.total}</span>
                </a>
              ))}
            </div>
          </details>
        )}
      </nav>
      <p className="lifecycle-note">
        {page.matched} {page.matched === 1 ? 'operation' : 'operations'}
        {group
          ? ` in ${group.title} · ${group.version}`
          : ' across all API versions'}{' '}
        · Page {page.number} of {page.pages}
      </p>
      {page.entries.length ? (
        <div className="lifecycle-entries">
          {page.entries.map((entry) => (
            <section
              className="lifecycle-card"
              key={entry.href}
              aria-label={`${entry.summary} · ${entry.version}`}
            >
              <div className="lifecycle-card-meta">
                <span>
                  {entry.apiTitle} · {entry.version}
                </span>
                <span className="lifecycle-status">{status(entry, date)}</span>
              </div>
              <h2>
                <a href={withBase(basePath, entry.href)} data-doc-route>
                  {entry.summary}
                </a>
              </h2>
              <div className="lifecycle-operation">
                <span className={`method-badge ${entry.method.toLowerCase()}`}>
                  {entry.method}
                </span>
                <code>{entry.path}</code>
                {entry.kind !== 'endpoint' && <span>{entry.kind}</span>}
              </div>
              <Guidance entry={entry} basePath={basePath} />
              {!entry.lifecycle.sunsetOn && (
                <p className="lifecycle-note">No sunset date announced.</p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <div className="callout">
          <Icon name="check" />
          <p>
            No deprecated operations or lifecycle announcements in this
            publication.
          </p>
        </div>
      )}
      <nav className="lifecycle-pagination" aria-label="Deprecation pages">
        {page.previous && (
          <a href={withBase(basePath, page.previous)} data-doc-route rel="prev">
            Previous page
          </a>
        )}
        <span>
          Page {page.number} of {page.pages}
        </span>
        {page.next && (
          <a href={withBase(basePath, page.next)} data-doc-route rel="next">
            Next page
          </a>
        )}
      </nav>
    </article>
  );
}
