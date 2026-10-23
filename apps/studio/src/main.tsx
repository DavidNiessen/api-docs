import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Project, Publication } from '@api-docs/domain';
import './styles.css';
import './island-layout.css';
function Studio() {
  const [sidebarWidth, setSidebarWidth] = useState(240);
  useEffect(() => {
    try {
      const stored = localStorage.getItem('api-docs-studio-navigation-width');
      if (stored && /^\d{3}$/.test(stored))
        setSidebarWidth(Math.max(200, Math.min(360, Number(stored))));
    } catch {
      /* Layout preferences are optional. */
    }
  }, []);
  const [token, setToken] = useState('');
  const [connected, setConnected] = useState(false);
  const [oidc, setOidc] = useState(false);
  const [subject, setSubject] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState('');
  const [tab, setTab] = useState('Overview');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [audit, setAudit] = useState<Record<string, unknown>[]>([]);
  const [issuedToken, setIssuedToken] = useState('');
  const project = projects.find((item) => item.id === selected);
  async function api<T>(
    path: string,
    method = 'GET',
    payload?: unknown,
  ): Promise<T> {
    const response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      redirect: 'error',
    });
    const data = (await response.json()) as T & { error?: string };
    if (!response.ok)
      throw new Error(data.error ?? `Request failed (${response.status})`);
    return data;
  }
  async function work(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await task();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The operation failed');
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    const data = await api<Project[]>('/api/projects');
    setProjects(data);
    if (!selected && data[0]) setSelected(data[0].id);
  }
  async function connect() {
    await work(async () => {
      const me = await api<{ subject: string | null; oidc: boolean }>(
        '/api/me',
      );
      setOidc(me.oidc);
      if (!me.subject)
        throw new Error(
          'Sign in with your identity provider or enter an operator/project token.',
        );
      setSubject(me.subject);
      if (token) await api('/auth/token', 'POST');
      await refresh();
      setToken('');
      setConnected(true);
    });
  }
  useEffect(() => {
    void fetch('/api/me')
      .then((response) => response.json())
      .then((me: { subject: string | null; oidc: boolean }) => {
        setOidc(me.oidc);
        if (me.subject) void connect();
      })
      .catch(() => setError('The management API is unavailable.'));
  }, []);
  useEffect(() => {
    setPublications([]);
    setAudit([]);
    setIssuedToken('');
    if (!selected || !['Publications', 'Audit log'].includes(tab)) return;
    void work(async () => {
      if (tab === 'Publications')
        setPublications(
          await api<Publication[]>(`/api/projects/${selected}/publications`),
        );
      if (tab === 'Audit log')
        setAudit(
          await api<Record<string, unknown>[]>(
            `/api/projects/${selected}/audit`,
          ),
        );
    });
  }, [selected, tab]);
  async function publish(artifactId: string) {
    if (!project) return;
    await api(`/api/projects/${project.id}/artifacts`, 'POST', { artifactId });
    await api(`/api/projects/${project.id}/publications`, 'POST', {
      artifactId,
      expectedPublicationId: project.activePublicationId,
      idempotencyKey: crypto.randomUUID(),
    });
    await refresh();
    setPublications(
      await api<Publication[]>(`/api/projects/${project.id}/publications`),
    );
    setMessage(
      'Publication activated. The prior release remains available for rollback.',
    );
  }
  return (
    <div className="studio">
      <header>
        <a className="studio-brand" href="/admin/">
          <span>✧</span>api-docs <small>Studio</small>
        </a>
        <span className="self-hosted">Self-hosted workspace</span>
        {connected && (
          <button
            type="button"
            onClick={() => {
              void work(async () => {
                await api('/auth/logout', 'POST');
                setToken('');
                setConnected(false);
                setProjects([]);
                setSelected('');
                setSubject('');
              });
            }}
          >
            Sign out
          </button>
        )}
      </header>
      {!connected ? (
        <main className="login">
          <div className="login-mark">✧</div>
          <p className="eyebrow">YOUR DOCUMENTATION, YOUR INFRASTRUCTURE</p>
          <h1>Welcome to your workspace</h1>
          <p>Publish beautiful documentation. Keep complete control.</p>
          {oidc && (
            <a className="primary" href="/auth/login">
              Continue with single sign-on →
            </a>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void connect();
            }}
          >
            <label>
              Operator or project token
              <input
                type="password"
                autoComplete="off"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Enter your access token"
                required
              />
            </label>
            <button className="primary" disabled={busy}>
              Connect to workspace →
            </button>
          </form>
          <small>
            Tokens are exchanged for an expiring HttpOnly session. They are
            never saved in browser storage.
          </small>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </main>
      ) : (
        <div
          className="studio-layout"
          style={{
            gridTemplateColumns: `min(${sidebarWidth}px, 30vw) minmax(0, 1fr)`,
          }}
        >
          <aside>
            <div className="workspace-label">WORKSPACE</div>
            <label className="project-picker">
              Current project
              <select
                aria-label="Current project"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
              >
                <option value="">Select a project</option>
                {projects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <nav>
              {['Overview', 'Publications', 'Access control', 'Audit log'].map(
                (name) => (
                  <button
                    type="button"
                    key={name}
                    className={tab === name ? 'selected' : ''}
                    aria-label={name}
                    onClick={() => setTab(name)}
                  >
                    <span>
                      {
                        {
                          Overview: '◈',
                          Publications: '↗',
                          'Access control': '⊙',
                          'Audit log': '≡',
                        }[name]
                      }
                    </span>
                    {name}
                  </button>
                ),
              )}
            </nav>
            <label className="studio-panel-size">
              <span>
                Navigation width <output>{sidebarWidth}px</output>
              </span>
              <input
                type="range"
                aria-label="Navigation width"
                min={200}
                max={360}
                step={8}
                value={sidebarWidth}
                onChange={(event) => {
                  const width = Number(event.target.value);
                  setSidebarWidth(width);
                  try {
                    localStorage.setItem(
                      'api-docs-studio-navigation-width',
                      String(width),
                    );
                  } catch {
                    /* Storage is optional. */
                  }
                }}
              />
            </label>
            <div className="identity">
              <span className="avatar">
                {subject.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <strong>Connected identity</strong>
                <small>{subject}</small>
              </div>
            </div>
          </aside>
          <main className="workspace-main">
            <div className="workspace-heading">
              <div>
                <p className="eyebrow">
                  WORKSPACE / {project?.name ?? 'PROJECTS'}
                </p>
                <h1>{tab}</h1>
                <p>
                  {
                    {
                      Overview:
                        'Your documentation, from source to production.',
                      Publications:
                        'Publish confidently. Roll back without losing history.',
                      'Access control':
                        'Give the right people the right level of access.',
                      'Audit log':
                        'A clear record of important workspace changes.',
                    }[tab]
                  }
                </p>
              </div>
              {project?.activePublicationId && (
                <a
                  className="secondary"
                  href={`/docs/${project.slug}/`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View documentation ↗
                </a>
              )}
            </div>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="success">
                {message}
              </p>
            )}
            {tab === 'Overview' && (
              <>
                <div className="stats-grid">
                  <div className="stat-card">
                    <span>Total projects</span>
                    <strong>{projects.length}</strong>
                    <small>Managed in this workspace</small>
                  </div>
                  <div className="stat-card">
                    <span>Publication</span>
                    <strong>
                      {project?.activePublicationId ? 'Live' : 'Unpublished'}
                    </strong>
                    <small>
                      {project
                        ? `/${project.slug}`
                        : 'Choose a project to get started'}
                    </small>
                  </div>
                  <div className="stat-card">
                    <span>Visibility</span>
                    <strong>{project?.visibility ?? '—'}</strong>
                    <small>Authorization covers every asset</small>
                  </div>
                </div>
                <section className="panel">
                  <h2>Create a project</h2>
                  <p>
                    Configure a documentation space. Project creation requires
                    operator access.
                  </p>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      void work(async () => {
                        const created = await api<Project>(
                          '/api/projects',
                          'POST',
                          {
                            name: String(form.get('name')),
                            slug: String(form.get('slug')),
                            visibility: String(form.get('visibility')),
                          },
                        );
                        await refresh();
                        setSelected(created.id);
                        setMessage(
                          'Project created. Build your publication with basePath /docs/' +
                            created.slug,
                        );
                      });
                    }}
                  >
                    <div className="form-grid">
                      <label>
                        Project name
                        <input
                          name="name"
                          required
                          maxLength={100}
                          placeholder="Platform API"
                        />
                      </label>
                      <label>
                        URL slug
                        <input
                          name="slug"
                          required
                          pattern="[a-z][a-z0-9-]{0,62}"
                          placeholder="platform"
                        />
                      </label>
                      <label>
                        Visibility
                        <select name="visibility">
                          <option value="private">Private</option>
                          <option value="public">Public</option>
                        </select>
                      </label>
                    </div>
                    <button className="primary" disabled={busy}>
                      Create project →
                    </button>
                  </form>
                </section>
                <section className="panel getting-started">
                  <h2>A simple path to great documentation</h2>
                  <ol>
                    <li>
                      <span>1</span>
                      <div>
                        <strong>Connect your OpenAPI specification</strong>
                        <p>
                          Use the CLI to import YAML or JSON and add your
                          guides.
                        </p>
                      </div>
                    </li>
                    <li>
                      <span>2</span>
                      <div>
                        <strong>Build and stage your publication</strong>
                        <p>
                          Verify the immutable artifact and stage it in your
                          configured storage.
                        </p>
                      </div>
                    </li>
                    <li>
                      <span>3</span>
                      <div>
                        <strong>Publish with confidence</strong>
                        <p>
                          Activate your release. Keep every previous version for
                          safe rollback.
                        </p>
                      </div>
                    </li>
                  </ol>
                </section>
              </>
            )}
            {tab === 'Publications' && (
              <>
                <section className="panel">
                  <h2>Activate a staged artifact</h2>
                  <p>
                    Build with{' '}
                    <code>basePath: /docs/{project?.slug ?? 'project'}</code>{' '}
                    and stage the output before activation.
                  </p>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      void work(() => publish(String(form.get('artifact'))));
                    }}
                  >
                    <label>
                      Artifact SHA-256
                      <input
                        name="artifact"
                        required
                        pattern="[a-f0-9]{64}"
                        placeholder="64-character verified artifact id"
                      />
                    </label>
                    <button className="primary" disabled={busy || !project}>
                      Verify and publish →
                    </button>
                  </form>
                </section>
                <section className="panel">
                  <h2>Publication history</h2>
                  {!publications.length ? (
                    <p>No publications yet. Your first release starts here.</p>
                  ) : (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Publication</th>
                            <th>Created</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {publications.map((publication) => (
                            <tr key={publication.id}>
                              <td>
                                <code title={publication.artifactId}>
                                  {publication.artifactId.slice(0, 12)}
                                </code>
                                <small>{publication.subject}</small>
                              </td>
                              <td>
                                {new Date(
                                  publication.createdAt,
                                ).toLocaleString()}
                              </td>
                              <td>
                                <span
                                  className={
                                    publication.id ===
                                    project?.activePublicationId
                                      ? 'badge live'
                                      : 'badge'
                                  }
                                >
                                  {publication.id ===
                                  project?.activePublicationId
                                    ? 'Live'
                                    : 'Retained'}
                                </span>
                              </td>
                              <td>
                                {publication.id !==
                                  project?.activePublicationId && (
                                  <button
                                    disabled={busy}
                                    type="button"
                                    onClick={() => {
                                      if (
                                        confirm(
                                          'Activate this previous artifact as a new publication?',
                                        )
                                      )
                                        void work(() =>
                                          publish(publication.artifactId),
                                        );
                                    }}
                                  >
                                    Roll back ↗
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}
            {tab === 'Access control' && (
              <>
                <section className="panel">
                  <h2>Manage identity access</h2>
                  <p>
                    Use the immutable identity provider issuer + subject. Set
                    “Remove access” to revoke a role immediately.
                  </p>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      void work(async () => {
                        await api(`/api/projects/${selected}/roles`, 'PUT', {
                          subject: String(form.get('subject')),
                          role: form.get('role') || null,
                        });
                        setMessage(
                          'Role updated. Permission changes apply to subsequent requests.',
                        );
                      });
                    }}
                  >
                    <div className="form-grid">
                      <label>
                        Identity subject
                        <input
                          name="subject"
                          required
                          placeholder="https://idp.example.com|subject-id"
                        />
                      </label>
                      <label>
                        Role
                        <select name="role">
                          <option>viewer</option>
                          <option>editor</option>
                          <option>publisher</option>
                          <option>admin</option>
                          <option value="">Remove access</option>
                        </select>
                      </label>
                    </div>
                    <button className="primary" disabled={busy || !project}>
                      Update access
                    </button>
                  </form>
                </section>
                <section className="panel">
                  <h2>Create a scoped token</h2>
                  <p>
                    Grant CI or integrations the smallest required permission.
                    Tokens expire within 90 days.
                  </p>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      void work(async () => {
                        const result = await api<{ token: string; id: string }>(
                          `/api/projects/${selected}/tokens`,
                          'POST',
                          {
                            label: String(form.get('label')),
                            role: String(form.get('role')),
                            expiresInDays: Number(form.get('days')),
                          },
                        );
                        setIssuedToken(result.token);
                        setMessage(
                          'Token id: ' +
                            result.id +
                            '. Copy the token now; it cannot be retrieved later.',
                        );
                      });
                    }}
                  >
                    <div className="form-grid">
                      <label>
                        Label
                        <input
                          name="label"
                          required
                          placeholder="Deploy pipeline"
                        />
                      </label>
                      <label>
                        Role
                        <select name="role">
                          <option>publisher</option>
                          <option>viewer</option>
                          <option>editor</option>
                          <option>admin</option>
                        </select>
                      </label>
                      <label>
                        Expiry (days)
                        <input
                          name="days"
                          type="number"
                          min={1}
                          max={90}
                          defaultValue={30}
                          required
                        />
                      </label>
                    </div>
                    <button className="primary" disabled={busy || !project}>
                      Create token
                    </button>
                  </form>
                  {issuedToken && (
                    <label className="issued-token">
                      Token (shown once)
                      <input
                        readOnly
                        type="password"
                        value={issuedToken}
                        onFocus={(event) => event.target.select()}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(issuedToken)
                            .then(() =>
                              setMessage('Token copied. Store it securely.'),
                            )
                            .catch(() =>
                              setError(
                                'Clipboard unavailable. Select the token and copy it manually.',
                              ),
                            );
                        }}
                      >
                        Copy token
                      </button>
                      <button type="button" onClick={() => setIssuedToken('')}>
                        Clear from view
                      </button>
                    </label>
                  )}
                </section>
                <section className="panel">
                  <h2>Revoke a token</h2>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      void work(async () => {
                        await api(
                          `/api/projects/${selected}/tokens/${String(form.get('id'))}`,
                          'DELETE',
                        );
                        setIssuedToken('');
                        setMessage('Token revoked.');
                      });
                    }}
                  >
                    <label>
                      Token id
                      <input
                        name="id"
                        required
                        placeholder="Token UUID from creation or audit history"
                      />
                    </label>
                    <button className="secondary" disabled={busy || !project}>
                      Revoke token
                    </button>
                  </form>
                </section>
              </>
            )}
            {tab === 'Audit log' && (
              <section className="panel">
                <h2>Recent events</h2>
                {audit.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Event</th>
                          <th>Actor</th>
                          <th>When</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {audit.map((event) => (
                          <tr key={String(event.id)}>
                            <td>
                              <code>{String(event.action)}</code>
                            </td>
                            <td>{String(event.actor)}</td>
                            <td>{String(event.created_at)}</td>
                            <td>
                              <code>{JSON.stringify(event.metadata)}</code>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>No audit events are available for this project.</p>
                )}
              </section>
            )}
            <footer>api-docs Studio · Self-hosted, open source, yours.</footer>
          </main>
        </div>
      )}
    </div>
  );
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<Studio />);
