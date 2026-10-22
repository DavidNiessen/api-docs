import { useEffect, useMemo, useRef, useState } from 'react';
import { exampleFor } from '@api-docs/contracts';
import type { ApiDocument, Operation } from '@api-docs/contracts';
import {
  generateSnippet,
  prepareRequest,
  redactRequest,
} from '@api-docs/explorer';
import type { PreparedRequest, SnippetLanguage } from '@api-docs/explorer';
import { CodeBlock } from './CodeBlock.js';
import { Icon } from './Icon.js';
export function Explorer({
  api,
  operation,
}: {
  api: ApiDocument;
  operation: Operation;
}) {
  const [server, setServer] = useState(
    operation.servers[0] ?? 'https://api.example.com',
  );
  const [parameters, setParameters] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      operation.parameters
        .filter((parameter) => parameter.required)
        .map((parameter) => {
          const value =
            parameter.example ?? exampleFor(parameter.schema, api.schemas);
          return [
            `${parameter.in}:${parameter.name}`,
            typeof value === 'string' ? value : JSON.stringify(value),
          ];
        }),
    ),
  );
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [language, setLanguage] = useState<SnippetLanguage>('cURL');
  const mediaTypes = Object.keys(operation.requestBody?.content ?? {});
  const [contentType, setContentType] = useState(
    mediaTypes[0] ?? 'application/json',
  );
  const [body, setBody] = useState(() => {
    const media = operation.requestBody?.content[mediaTypes[0] ?? ''];
    return media
      ? JSON.stringify(
          media.example ?? exampleFor(media.schema, api.schemas),
          null,
          2,
        )
      : '';
  });
  const [tab, setTab] = useState<'request' | 'response'>('request');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [response, setResponse] = useState<{
    status: number;
    duration: number;
    body: string;
    headers: string;
  }>();
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );
  const authNames = [
    ...new Set(
      operation.security.flatMap((alternative) => Object.keys(alternative)),
    ),
  ];
  const preview = useMemo(() => {
    try {
      const placeholderCredentials = Object.fromEntries(
        authNames.map((name) => [name, 'YOUR_CREDENTIAL']),
      );
      return {
        request: prepareRequest(operation, api.securitySchemes, {
          server,
          parameters,
          body,
          contentType,
          credentials: placeholderCredentials,
        }),
        error: '',
      };
    } catch (error) {
      return {
        request: undefined,
        error: error instanceof Error ? error.message : 'Invalid request',
      };
    }
  }, [
    operation,
    api,
    server,
    parameters,
    body,
    contentType,
    authNames.join(','),
  ]);
  async function execute() {
    setError('');
    let request: PreparedRequest;
    try {
      request = prepareRequest(operation, api.securitySchemes, {
        server,
        parameters,
        body,
        contentType,
        credentials,
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Invalid request');
      return;
    }
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE', 'TRACE'].includes(request.method) &&
      !window.confirm(
        `Send ${request.method} to ${new URL(request.url).origin}? This may modify data.`,
      )
    )
      return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 30_000);
    setBusy(true);
    setTab('response');
    const start = performance.now();
    try {
      const result = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        ...(request.body ? { body: request.body } : {}),
        signal: abort.signal,
        credentials: 'omit',
        redirect: 'error',
      });
      const reader = result.body?.getReader();
      const decoder = new TextDecoder();
      let text = '';
      let size = 0;
      if (reader)
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 2 * 1024 * 1024) {
            await reader.cancel();
            text += '\n[Response truncated at 2 MiB]';
            break;
          }
          text += decoder.decode(part.value, { stream: true });
        }
      try {
        text = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* Preserve text responses. */
      }
      setResponse({
        status: result.status,
        duration: Math.round(performance.now() - start),
        body: text || '(empty response)',
        headers: [...result.headers]
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n'),
      });
    } catch (error) {
      setError(
        error instanceof Error && error.name === 'AbortError'
          ? 'Request cancelled or timed out after 30 seconds.'
          : 'The browser could not complete this request. Check the destination, CORS policy and network connection. Copy the cURL example to run it locally.',
      );
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  }
  return (
    <aside className="explorer" aria-label="API playground">
      <div className="explorer-header">
        <span className="live-dot" />
        API playground<span className="playground-label">Interactive</span>
      </div>
      <div className="explorer-tabs">
        <button
          type="button"
          className={tab === 'request' ? 'active' : ''}
          onClick={() => setTab('request')}
        >
          Request
        </button>
        <button
          type="button"
          className={tab === 'response' ? 'active' : ''}
          onClick={() => setTab('response')}
        >
          Response
          {response && (
            <span
              className={
                response.status < 400 ? 'response-success' : 'response-failed'
              }
            >
              {response.status}
            </span>
          )}
        </button>
      </div>
      {tab === 'request' ? (
        <>
          <div className="request-fields">
            <label>
              Server
              <input
                aria-label="API server"
                value={server}
                onChange={(event) => setServer(event.target.value)}
                spellCheck={false}
              />
            </label>
            {!operation.servers.length && (
              <p className="subtle">
                No server defined in the spec. Set your API URL.
              </p>
            )}
            {operation.parameters.map((parameter) => (
              <label key={`${parameter.in}:${parameter.name}`}>
                <span>
                  <code>{parameter.name}</code>
                  <small>
                    {parameter.in}
                    {parameter.required ? ' · required' : ''}
                  </small>
                </span>
                <input
                  aria-label={`${parameter.name} parameter`}
                  value={parameters[`${parameter.in}:${parameter.name}`] ?? ''}
                  placeholder={
                    parameter.schema.type === 'array'
                      ? '["value"]'
                      : parameter.schema.type === 'object'
                        ? '{"key":"value"}'
                        : 'Enter a value'
                  }
                  onChange={(event) =>
                    setParameters({
                      ...parameters,
                      [`${parameter.in}:${parameter.name}`]: event.target.value,
                    })
                  }
                />
              </label>
            ))}
            {authNames.length > 0 && (
              <details className="auth-fields" open>
                <summary>
                  <Icon name="lock" size={14} />
                  Authentication
                </summary>
                <p>
                  Use one complete authentication alternative. Credentials stay
                  in memory.
                </p>
                {authNames.map((name) => (
                  <label key={name}>
                    {name}
                    <input
                      type="password"
                      autoComplete="off"
                      aria-label={`${name} credential`}
                      value={credentials[name] ?? ''}
                      onChange={(event) =>
                        setCredentials({
                          ...credentials,
                          [name]: event.target.value,
                        })
                      }
                      placeholder={
                        api.securitySchemes[name]?.scheme === 'basic'
                          ? 'username:password'
                          : 'Enter token or API key'
                      }
                    />
                  </label>
                ))}
              </details>
            )}
            {operation.requestBody && (
              <>
                <label>
                  Content type
                  <select
                    value={contentType}
                    onChange={(event) => {
                      setContentType(event.target.value);
                      const media =
                        operation.requestBody?.content[event.target.value];
                      setBody(
                        JSON.stringify(
                          media?.example ??
                            exampleFor(media?.schema ?? {}, api.schemas),
                          null,
                          2,
                        ),
                      );
                    }}
                  >
                    {mediaTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Request body
                  <textarea
                    aria-label="Request body"
                    value={body}
                    spellCheck={false}
                    rows={8}
                    onChange={(event) => setBody(event.target.value)}
                  />
                </label>
              </>
            )}
          </div>
          <div className="snippet-controls">
            <select
              aria-label="Code language"
              value={language}
              onChange={(event) =>
                setLanguage(event.target.value as SnippetLanguage)
              }
            >
              {['cURL', 'JavaScript', 'TypeScript', 'Python', 'Java'].map(
                (item) => (
                  <option key={item}>{item}</option>
                ),
              )}
            </select>
            <span>Example</span>
          </div>
          {preview.request ? (
            <CodeBlock
              code={generateSnippet(
                redactRequest(preview.request, credentials),
                language,
              )}
              language={language}
            />
          ) : (
            <p className="preview-error">{preview.error}</p>
          )}
        </>
      ) : (
        <div className="response-content">
          {response ? (
            <>
              <div className="response-meta">
                <span
                  className={
                    response.status < 400
                      ? 'response-success'
                      : 'response-failed'
                  }
                >
                  {response.status}
                </span>
                <span>{response.duration} ms</span>
              </div>
              <CodeBlock code={response.body} title="Response body" />
              <details>
                <summary>Response headers</summary>
                <pre>{response.headers}</pre>
              </details>
            </>
          ) : (
            <div className="response-empty">
              <Icon name="terminal" size={30} />
              <h3>Your response will appear here</h3>
              <p>Send a request to try this endpoint.</p>
            </div>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="request-error">
          {error}
        </p>
      )}
      <div className="send-request">
        <button
          type="button"
          className="button-primary"
          disabled={busy}
          onClick={() => {
            void execute();
          }}
        >
          {busy ? 'Sending…' : 'Send request'}
          <Icon name="arrow" size={16} />
        </button>
        {busy && (
          <button type="button" onClick={() => controller.current?.abort()}>
            Cancel
          </button>
        )}
        <p>Requests are sent directly from your browser.</p>
      </div>
    </aside>
  );
}
