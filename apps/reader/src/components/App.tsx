import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { createSearchIndex, search } from '@api-docs/search';
import {
  exampleFor,
  guideHref,
  operationHref,
  withBase,
  normalizePagePath,
} from '@api-docs/contracts';
import type {
  ApiDocument,
  Operation,
  SiteData,
  SearchResult,
} from '@api-docs/contracts';
import { Icon } from './Icon.js';
import { Explorer } from './Explorer.js';
import { SchemaView } from './SchemaView.js';
import { CodeBlock } from './CodeBlock.js';

export function App({
  site: initialSite,
  initialPath,
}: {
  site: SiteData;
  initialPath: string;
}) {
  const [site, setSite] = useState(initialSite);
  const [path, setPath] = useState(initialPath);
  const [loading, setLoading] = useState(false);
  const [searchIndex, setSearchIndex] = useState(() =>
    createSearchIndex(initialSite),
  );
  const searchLoaded = useRef(false);
  const searchWorker = useRef<Worker | null>(null);
  const searchRequest = useRef(0);
  const [workerFailed, setWorkerFailed] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchKind, setSearchKind] = useState('');
  const [searchVersion, setSearchVersion] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const navigationId = useRef(0);
  const [mobileNav, setMobileNav] = useState(false);
  const [theme, setTheme] = useState('light');
  const [query, setQuery] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const config = site.config;
  const href = (value: string) => withBase(config.basePath, value);
  const activeGuide =
    site.guides.find((guide) => guideHref(guide) === path) ??
    (path === '/' ? site.guides[0] : undefined);
  let activeApi =
    site.apis.find((api) =>
      api.operations.some(
        (operation) => operationHref(api, operation) === path,
      ),
    ) ?? site.apis[0];
  const activeOperation =
    activeApi?.operations.find(
      (operation) => operationHref(activeApi!, operation) === path,
    ) ??
    (path === '/' && !site.guides.length
      ? activeApi?.operations[0]
      : undefined);
  const [selectedApi, setSelectedApi] = useState(
    activeApi ? `${activeApi.id}:${activeApi.version}` : '',
  );
  if (!activeOperation)
    activeApi =
      site.apis.find((api) => `${api.id}:${api.version}` === selectedApi) ??
      activeApi;
  const firstApi = activeApi?.operations[0];
  const title =
    activeGuide?.title ??
    activeOperation?.summary ??
    (path === '/' ? 'Welcome' : 'Page not found');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('api-docs-theme');
      setTheme(
        saved === 'dark' ||
          (!saved && matchMedia('(prefers-color-scheme: dark)').matches)
          ? 'dark'
          : 'light',
      );
    } catch {
      /* Storage can be disabled. */
    }
    const pop = () => {
      void loadPage(new URL(window.location.href), false);
    };
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('popstate', pop);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('popstate', pop);
      window.removeEventListener('keydown', key);
    };
  }, [config.basePath]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    document.title = `${title} · ${config.name}`;
  }, [title, config.name]);
  function navigate(event: MouseEvent<HTMLDivElement>) {
    const target = (event.target as Element).closest<HTMLAnchorElement>(
      'a[data-doc-route]',
    );
    if (
      !target ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    const url = new URL(target.href);
    if (url.pathname === window.location.pathname && url.hash) {
      document.getElementById(url.hash.slice(1))?.scrollIntoView();
      return;
    }
    void loadPage(url, true);
  }
  function openSearch() {
    dialog.current?.showModal();
    if (!searchLoaded.current) {
      searchLoaded.current = true;
      setSearchLoading(true);
      if (!searchWorker.current && !workerFailed) {
        try {
          const worker = new Worker(
            new URL('../search.worker.ts', import.meta.url),
            { type: 'module' },
          );
          worker.onmessage = (
            event: MessageEvent<{ id: number; results: SearchResult[] }>,
          ) => {
            if (event.data.id === searchRequest.current)
              setSearchResults(event.data.results);
          };
          worker.onerror = () => {
            worker.terminate();
            searchWorker.current = null;
            setWorkerFailed(true);
          };
          searchWorker.current = worker;
        } catch {
          setWorkerFailed(true);
        }
      }
      void (async () => {
        const response = await fetch(href('/search-manifest.json'), {
          credentials: 'same-origin',
        });
        if (!response.ok) throw new Error('Search unavailable');
        const manifest = (await response.json()) as {
          schemaVersion: number;
          shards: string[];
        };
        if (
          manifest.schemaVersion !== 1 ||
          !Array.isArray(manifest.shards) ||
          manifest.shards.length > 1000
        )
          throw new Error('Invalid search manifest');
        const index: ReturnType<typeof createSearchIndex> = [];
        for (let offset = 0; offset < manifest.shards.length; offset += 4) {
          const batch = await Promise.all(
            manifest.shards.slice(offset, offset + 4).map(async (file) => {
              if (!/^search\/\d+\.json$/.test(file))
                throw new Error('Invalid search shard path');
              const response = await fetch(href('/' + file), {
                credentials: 'same-origin',
              });
              if (!response.ok) throw new Error('Search unavailable');
              return (await response.json()) as ReturnType<
                typeof createSearchIndex
              >;
            }),
          );
          for (const shard of batch) index.push(...shard);
        }
        searchWorker.current?.postMessage({ kind: 'load', index });
        setSearchIndex(index);
      })()
        .catch(() => {
          searchLoaded.current = false;
        })
        .finally(() => setSearchLoading(false));
    }
  }
  useEffect(() => {
    const id = ++searchRequest.current;
    const filter = {
      ...(searchKind ? { kind: searchKind } : {}),
      ...(searchVersion ? { version: searchVersion } : {}),
    };
    if (searchWorker.current && !workerFailed)
      searchWorker.current.postMessage({ kind: 'query', id, query, filter });
    else setSearchResults(search(searchIndex, query, filter));
  }, [query, searchIndex, searchKind, searchVersion, workerFailed]);
  useEffect(() => () => searchWorker.current?.terminate(), []);
  async function loadPage(url: URL, push: boolean) {
    const id = ++navigationId.current;
    const nextPath = normalizePagePath(
      url.pathname.slice(config.basePath.length) || '/',
    );
    setLoading(true);
    try {
      const response = await fetch(
        href(
          `${nextPath.endsWith('/') ? nextPath : `${nextPath}/`}page-data.json`,
        ),
        { credentials: 'same-origin' },
      );
      if (!response.ok) throw new Error('Page data unavailable');
      const next = (await response.json()) as SiteData;
      if (next.schemaVersion !== 1 || !next.config || !Array.isArray(next.apis))
        throw new Error('Invalid page data');
      if (id !== navigationId.current) return;
      if (push) history.pushState({}, '', url.pathname + url.hash);
      setSite(next);
      setPath(nextPath);
      setMobileNav(false);
      dialog.current?.close();
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (url.hash)
        setTimeout(
          () => document.getElementById(url.hash.slice(1))?.scrollIntoView(),
          0,
        );
    } catch {
      if (id === navigationId.current) window.location.assign(url.href);
    } finally {
      if (id === navigationId.current) setLoading(false);
    }
  }

  const groups = [...new Set(site.guides.map((guide) => guide.group))];
  const tags = [
    ...new Set(
      activeApi?.operations.flatMap((operation) =>
        operation.tags.length ? operation.tags.slice(0, 1) : ['Endpoints'],
      ) ?? [],
    ),
  ];
  const results = searchResults;
  return (
    <div
      className={`docs-shell density-${config.theme.density} font-${config.theme.font}`}
      style={
        {
          '--accent': config.theme.accent,
          '--radius': `${config.theme.radius}px`,
        } as CSSProperties
      }
      onClick={navigate}
    >
      {loading && (
        <div className="page-loading" role="status">
          Loading documentation…
        </div>
      )}
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-main">
          <a className="brand" href={href('/')} data-doc-route>
            <span className="brand-mark">
              <Icon name="spark" size={21} />
            </span>
            <span>{config.name}</span>
            <span className="docs-label">docs</span>
          </a>
          <button
            className="search-trigger"
            type="button"
            onClick={() => openSearch()}
          >
            <Icon name="search" size={17} />
            <span>Search documentation…</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="header-actions">
            {config.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target={link.href.startsWith('https:') ? '_blank' : undefined}
                rel="noreferrer"
              >
                {link.label}
                <Icon name="external" size={13} />
              </a>
            ))}
            <button
              type="button"
              className="icon-button theme-toggle"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              onClick={() => {
                const next = theme === 'light' ? 'dark' : 'light';
                setTheme(next);
                try {
                  localStorage.setItem('api-docs-theme', next);
                } catch {
                  /* Optional preference. */
                }
              }}
            >
              <Icon name={theme === 'light' ? 'moon' : 'sun'} />
            </button>
            <button
              type="button"
              className="icon-button mobile-menu"
              aria-label="Toggle navigation"
              aria-expanded={mobileNav}
              onClick={() => setMobileNav(!mobileNav)}
            >
              <Icon name={mobileNav ? 'close' : 'menu'} />
            </button>
          </div>
        </div>
        <nav className="header-tabs" aria-label="Documentation sections">
          <a
            className={!activeOperation ? 'active' : ''}
            href={href(site.guides[0] ? guideHref(site.guides[0]) : '/')}
            data-doc-route
          >
            <Icon name="book" size={16} />
            Documentation
          </a>
          {firstApi && activeApi && (
            <a
              className={activeOperation ? 'active' : ''}
              href={href(operationHref(activeApi, firstApi))}
              data-doc-route
            >
              <Icon name="code" size={16} />
              API Reference
            </a>
          )}
          <span className="header-version">
            <span className="live-dot" />
            Built for developers
          </span>
        </nav>
      </header>
      <div className="docs-layout">
        <aside
          className={`sidebar ${mobileNav ? 'is-open' : ''}`}
          aria-label="Documentation navigation"
        >
          {site.apis.length > 1 ? (
            <label className="version-select">
              API version
              <select
                value={selectedApi}
                onChange={(event) => {
                  setSelectedApi(event.target.value);
                  const api = site.apis.find(
                    (item) =>
                      `${item.id}:${item.version}` === event.target.value,
                  );
                  if (api?.operations[0]) {
                    const target = operationHref(api, api.operations[0]);
                    void loadPage(
                      new URL(href(target), window.location.origin),
                      true,
                    );
                  }
                }}
              >
                {site.apis.map((api) => (
                  <option
                    key={`${api.id}:${api.version}`}
                    value={`${api.id}:${api.version}`}
                  >
                    {api.title} · {api.version}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="sidebar-project">
              <Icon name="globe" size={16} />
              <span>Developer resources</span>
              {activeApi && (
                <span className="version-pill">{activeApi.version}</span>
              )}
            </div>
          )}
          {groups.map((group) => (
            <nav className="nav-group" key={group} aria-label={group}>
              <h2>{group}</h2>
              {site.guides
                .filter((guide) => guide.group === group)
                .map((guide, index) => (
                  <a
                    className={
                      activeGuide?.slug === guide.slug
                        ? 'nav-link active'
                        : 'nav-link'
                    }
                    key={guide.slug}
                    href={href(guideHref(guide))}
                    data-doc-route
                    aria-current={
                      activeGuide?.slug === guide.slug ? 'page' : undefined
                    }
                  >
                    <Icon
                      name={
                        ['book', 'bolt', 'shield', 'settings'][index % 4] ??
                        'book'
                      }
                      size={16}
                    />
                    <span>{guide.title}</span>
                  </a>
                ))}
            </nav>
          ))}
          {activeApi &&
            tags.map((tag) => (
              <nav
                className="nav-group"
                key={tag}
                aria-label={`${tag} endpoints`}
              >
                <h2>{tag}</h2>
                {activeApi!.operations
                  .filter(
                    (operation) => (operation.tags[0] ?? 'Endpoints') === tag,
                  )
                  .map((operation) => (
                    <a
                      key={operation.slug}
                      href={href(operationHref(activeApi!, operation))}
                      data-doc-route
                      className={
                        activeOperation?.slug === operation.slug
                          ? 'nav-link endpoint-link active'
                          : 'nav-link endpoint-link'
                      }
                      aria-current={
                        activeOperation?.slug === operation.slug
                          ? 'page'
                          : undefined
                      }
                    >
                      <span className={`method-badge ${operation.method}`}>
                        {operation.method}
                      </span>
                      <span>{operation.summary}</span>
                    </a>
                  ))}
              </nav>
            ))}
          {site.navigationTruncated && (
            <button
              type="button"
              className="nav-search-more"
              onClick={openSearch}
            >
              <Icon name="search" size={14} />
              Search all {site.navigationTotal} pages
            </button>
          )}
          <div className="sidebar-bottom">
            <span className="brand-mark small">
              <Icon name="spark" size={14} />
            </span>
            <span>
              Powered by <strong>api-docs</strong>
            </span>
            <span className="open-source-label">Open source</span>
          </div>
        </aside>
        <main
          id="main-content"
          className={
            activeOperation ? 'main-area api-layout' : 'main-area guide-layout'
          }
          tabIndex={-1}
        >
          {activeOperation && activeApi ? (
            <>
              <article className="article api-article">
                <div className="breadcrumb">
                  API Reference
                  <Icon name="chevron" size={12} />
                  {activeOperation.tags[0] ?? activeApi.title}
                </div>
                <div className="eyebrow">
                  {activeOperation.tags[0] ?? 'API Reference'}
                </div>
                <h1>{activeOperation.summary}</h1>
                <p className="page-description">
                  {activeOperation.description ||
                    `Use this endpoint to ${activeOperation.summary.toLowerCase()}.`}
                </p>
                {activeOperation.kind &&
                  activeOperation.kind !== 'endpoint' && (
                    <div className="callout">
                      <Icon name="info" />
                      <span>
                        {activeOperation.kind === 'webhook'
                          ? 'Webhook'
                          : 'Callback'}
                        : your application receives this request from the API
                        provider.
                        {activeOperation.callback && (
                          <>
                            {' '}
                            Triggered by{' '}
                            <code>
                              {activeOperation.callback.operationId}
                            </code>{' '}
                            using{' '}
                            <code>{activeOperation.callback.expression}</code>.
                          </>
                        )}
                      </span>
                    </div>
                  )}
                {activeOperation.deprecated && (
                  <div className="callout warning">
                    <Icon name="info" />
                    This endpoint is deprecated. Check the migration guide
                    before integrating.
                  </div>
                )}
                <div className="endpoint-address">
                  <span className={`method-badge ${activeOperation.method}`}>
                    {activeOperation.method}
                  </span>
                  <code>{activeOperation.path}</code>
                  <span className="endpoint-version">{activeApi.version}</span>
                </div>
                <OperationDetails
                  key={`${activeApi.id}:${activeApi.version}:${activeOperation.slug}`}
                  api={activeApi}
                  operation={activeOperation}
                />
                <PageFooter source={activeOperation.source} />
              </article>
              {!activeOperation.kind || activeOperation.kind === 'endpoint' ? (
                <Explorer
                  key={`${activeApi.id}:${activeApi.version}:${activeOperation.slug}`}
                  api={activeApi}
                  operation={activeOperation}
                />
              ) : (
                <aside
                  className="explorer-column"
                  aria-label="Event payload examples"
                >
                  {Object.entries(
                    activeOperation.requestBody?.content ?? {},
                  ).map(([type, media]) => (
                    <CodeBlock
                      key={type}
                      title={`Incoming payload · ${type}`}
                      code={JSON.stringify(
                        media.example ??
                          exampleFor(media.schema, activeApi.schemas),
                        null,
                        2,
                      )}
                    />
                  ))}
                </aside>
              )}
            </>
          ) : activeGuide ? (
            <>
              <article className="article guide-article">
                <div className="breadcrumb">
                  Documentation
                  <Icon name="chevron" size={12} />
                  {activeGuide.group}
                </div>
                <div className="eyebrow">{activeGuide.group}</div>
                <h1>{activeGuide.title}</h1>
                {activeGuide.description && (
                  <p className="page-description">{activeGuide.description}</p>
                )}
                <div
                  className="guide-content"
                  dangerouslySetInnerHTML={{ __html: activeGuide.html }}
                />
                <div className="next-pages">
                  {site.guides
                    .filter((guide) => guide.slug !== activeGuide.slug)
                    .slice(0, 2)
                    .map((guide) => (
                      <a
                        key={guide.slug}
                        href={href(guideHref(guide))}
                        data-doc-route
                      >
                        <Icon name="book" />
                        <strong>{guide.title}</strong>
                        <span>{guide.description || 'Continue reading'}</span>
                        <Icon name="arrow" />
                      </a>
                    ))}
                </div>
                <PageFooter source={activeGuide.source} />
              </article>
              <aside className="page-toc">
                <h2>
                  <Icon name="menu" size={14} />
                  On this page
                </h2>
                <nav>
                  {activeGuide.headings
                    .filter((heading) => heading.level > 1 && heading.level < 4)
                    .map((heading) => (
                      <a
                        key={heading.id}
                        href={`#${heading.id}`}
                        className={heading.level === 3 ? 'nested' : ''}
                      >
                        {heading.text}
                      </a>
                    ))}
                </nav>
                <div className="toc-help">
                  <Icon name="code" />
                  <strong>Build something great</strong>
                  <p>
                    Explore endpoints and try your first request in the API
                    playground.
                  </p>
                  {activeApi && firstApi && (
                    <a
                      href={href(operationHref(activeApi, firstApi))}
                      data-doc-route
                    >
                      Explore the API <Icon name="arrow" size={14} />
                    </a>
                  )}
                </div>
              </aside>
            </>
          ) : (
            <article className="article">
              <div className="eyebrow">404</div>
              <h1>Page not found</h1>
              <p>
                This page may have moved. Try search or return to the
                documentation.
              </p>
              <a className="button-primary" href={href('/')} data-doc-route>
                Back to documentation
                <Icon name="arrow" />
              </a>
            </article>
          )}
        </main>
      </div>
      <dialog
        className="search-dialog"
        ref={dialog}
        aria-label="Search documentation"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="search-input-row">
          <Icon name="search" />
          <input
            autoFocus
            aria-label="Search documentation"
            placeholder="Search documentation…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close search"
          >
            <kbd>Esc</kbd>
          </button>
        </div>
        <div className="search-filters">
          <label>
            Content
            <select
              aria-label="Search content type"
              value={searchKind}
              onChange={(event) => setSearchKind(event.target.value)}
            >
              <option value="">All content</option>
              <option value="guide">Guides</option>
              <option value="operation">API endpoints</option>
            </select>
          </label>
          <label>
            API version
            <select
              aria-label="Search API version"
              value={searchVersion}
              onChange={(event) => setSearchVersion(event.target.value)}
            >
              <option value="">All versions</option>
              {[
                ...new Set(
                  searchIndex.map((entry) => entry.version).filter(Boolean),
                ),
              ].map((version) => (
                <option key={version}>{version}</option>
              ))}
            </select>
          </label>
          {searchLoading && <small role="status">Loading search…</small>}
        </div>
        <div className="search-results">
          {query ? (
            results.length ? (
              results.map((result) => (
                <a key={result.id} href={href(result.href)} data-doc-route>
                  <span className="search-result-icon">
                    {result.method ? (
                      <span className={`method-badge ${result.method}`}>
                        {result.method}
                      </span>
                    ) : (
                      <Icon name="book" />
                    )}
                  </span>
                  <span>
                    <small>
                      {result.group}
                      {result.version ? ` · ${result.version}` : ''}
                    </small>
                    <strong>{result.title}</strong>
                    <p>{result.excerpt}</p>
                  </span>
                  <Icon name="arrow" size={16} />
                </a>
              ))
            ) : (
              <div className="search-empty">
                <Icon name="search" size={28} />
                <h3>No matching results</h3>
                <p>Try a different term, endpoint, or parameter name.</p>
              </div>
            )
          ) : (
            <div className="search-empty">
              <Icon name="spark" size={28} />
              <h3>What would you like to build?</h3>
              <p>Search guides, endpoints, and parameters.</p>
            </div>
          )}
        </div>
        <div className="search-dialog-footer">
          Local search · Your queries stay in your browser<span>⌘ K</span>
        </div>
      </dialog>
    </div>
  );
}
function OperationDetails({
  api,
  operation,
}: {
  api: ApiDocument;
  operation: Operation;
}) {
  const [responseStatus, setResponseStatus] = useState(
    operation.responses[0]?.status ?? '200',
  );
  const response =
    operation.responses.find((item) => item.status === responseStatus) ??
    operation.responses[0];
  const responseMedia = Object.entries(response?.content ?? {})[0];
  return (
    <>
      {operation.security.length > 0 && (
        <section id="authentication">
          <h2>
            <Icon name="lock" size={19} />
            Authorization
          </h2>
          <div className="callout">
            <Icon name="shield" />
            <span>
              Authentication is required.{' '}
              {operation.security
                .map(
                  (alternative) =>
                    Object.keys(alternative).join(' + ') || 'Anonymous',
                )
                .join(' or ')}
              <br />
              <small>
                Enter credentials in the playground. They are never saved.
              </small>
            </span>
          </div>
        </section>
      )}
      {['path', 'query', 'header', 'cookie'].map((location) => {
        const parameters = operation.parameters.filter(
          (parameter) => parameter.in === location,
        );
        return parameters.length ? (
          <section key={location} id={`${location}-parameters`}>
            <h2>
              {location[0]?.toUpperCase()}
              {location.slice(1)} parameters
            </h2>
            {parameters.map((parameter) => (
              <div className="parameter-row" key={parameter.name}>
                <div className="field-heading">
                  <code>{parameter.name}</code>
                  <span className="type-label">
                    {String(parameter.schema.type ?? 'string')}
                  </span>
                  {parameter.required && (
                    <span className="required">required</span>
                  )}
                </div>
                <p>
                  {parameter.description ||
                    `The ${parameter.name} ${location} parameter.`}
                </p>
                <SchemaView schema={parameter.schema} schemas={api.schemas} />
              </div>
            ))}
          </section>
        ) : null;
      })}
      {operation.requestBody && (
        <section id="request-body">
          <h2>
            Request body
            {operation.requestBody.required && (
              <span className="required">required</span>
            )}
          </h2>
          {operation.requestBody.description && (
            <p>{operation.requestBody.description}</p>
          )}
          {Object.entries(operation.requestBody.content).map(
            ([type, media]) => (
              <div key={type}>
                <span className="media-label">{type}</span>
                <SchemaView schema={media.schema} schemas={api.schemas} />
              </div>
            ),
          )}
        </section>
      )}
      <section id="responses">
        <h2>Response</h2>
        {!operation.responses.length && (
          <p>No responses are documented in this specification.</p>
        )}
        <div className="status-tabs">
          {operation.responses.map((item) => (
            <button
              type="button"
              key={item.status}
              className={responseStatus === item.status ? 'active' : ''}
              onClick={() => setResponseStatus(item.status)}
            >
              <span
                className={
                  item.status.startsWith('2') ? 'live-dot' : 'status-dot'
                }
              />
              {item.status}
            </button>
          ))}
        </div>
        <p>{response?.description}</p>
        {responseMedia && (
          <>
            <span className="media-label">{responseMedia[0]}</span>
            <SchemaView
              schema={responseMedia[1].schema}
              schemas={api.schemas}
            />
            <CodeBlock
              title="Example response"
              code={JSON.stringify(
                responseMedia[1].example ??
                  exampleFor(responseMedia[1].schema, api.schemas),
                null,
                2,
              )}
            />
          </>
        )}
      </section>
    </>
  );
}
function PageFooter({ source }: { source: string }) {
  return (
    <footer className="article-footer">
      <div>
        <Icon name="code" size={15} />
        <span>
          Source: <code>{source}</code>
        </span>
      </div>
      <span>Built with api-docs</span>
    </footer>
  );
}
