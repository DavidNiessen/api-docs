import { useEffect, useMemo, useRef, useState } from 'react';
import {
  exampleChoices,
  formatExample,
  hasExternalExamples,
} from '@api-docs/contracts';
import type { ApiDocument, Operation } from '@api-docs/contracts';
import {
  generateSnippet,
  prepareRequest,
  redactRequest,
} from '@api-docs/explorer';
import type { PreparedRequest, SnippetLanguage } from '@api-docs/explorer';
import { CodeBlock } from './CodeBlock.js';
import { Icon } from './Icon.js';
import { AuthField } from './AuthField.js';
export function Explorer({
  api,
  operation,
  basePath = '',
  oauthClients,
}: {
  api: ApiDocument;
  operation: Operation;
  basePath?: string;
  oauthClients?:
    Record<string, { clientId: string; issuer: string }> | undefined;
}) {
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(location.origin), []);
  const [server, setServer] = useState(
    operation.servers[0] ?? 'https://api.example.com',
  );
  const [parameters, setParameters] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      operation.parameters
        .filter((parameter) => parameter.required)
        .map((parameter) => {
          const value = exampleChoices(parameter, api.schemas)[0]!.value;
          return [
            `${parameter.in}:${parameter.name}`,
            typeof value === 'string' ? value : JSON.stringify(value),
          ];
        }),
    ),
  );
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const responseTypes = [
    ...new Set(
      operation.responses
        .filter((item) => /^2/.test(item.status))
        .flatMap((item) => Object.keys(item.content)),
    ),
  ];
  const [accept, setAccept] = useState(responseTypes[0] ?? '*/*');
  const [language, setLanguage] = useState<SnippetLanguage>('cURL');
  const mediaTypes = Object.keys(operation.requestBody?.content ?? {});
  const [contentType, setContentType] = useState(
    mediaTypes[0] ?? 'application/json',
  );
  const initialMedia = operation.requestBody?.content[mediaTypes[0] ?? ''];
  const initialChoices = initialMedia
    ? exampleChoices(initialMedia, api.schemas)
    : [];
  const [requestExample, setRequestExample] = useState(
    initialChoices[0]?.id ?? '',
  );
  const [body, setBody] = useState(() =>
    initialChoices.length
      ? formatExample(initialChoices[0]!.value, mediaTypes[0]!)
      : '',
  );
  const requestMedia = operation.requestBody?.content[contentType];
  const requestChoices = requestMedia
    ? exampleChoices(requestMedia, api.schemas)
    : [];
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
          accept,
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
    accept,
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
        accept,
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
      <div hidden={tab !== 'request'}>
        <>
          <div className="request-fields">
            <label>
              Server
              <input
                aria-label="API server"
                value={server}
                onChange={(event) => {
                  setServer(event.target.value);
                  setCredentials({});
                }}
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
                  in memory and clear when the API server changes.
                </p>
                {authNames.map((name) => (
                  <AuthField
                    key={JSON.stringify([server, name])}
                    name={name}
                    scheme={api.securitySchemes[name]}
                    credential={credentials[name] ?? ''}
                    onChange={(value) =>
                      setCredentials((current) => ({
                        ...current,
                        [name]: value,
                      }))
                    }
                    scopes={
                      operation.security.find((alternative) =>
                        Object.hasOwn(alternative, name),
                      )?.[name] ?? []
                    }
                    client={oauthClients?.[name]}
                    server={server}
                    redirectUri={
                      origin ? `${origin}${basePath}/oauth/callback/` : ''
                    }
                  />
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
                      const choices = media
                        ? exampleChoices(media, api.schemas)
                        : [];
                      setRequestExample(choices[0]?.id ?? '');
                      setBody(
                        choices.length
                          ? formatExample(choices[0]!.value, event.target.value)
                          : '',
                      );
                    }}
                  >
                    {mediaTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </label>
                {requestChoices.length > 0 &&
                  (requestChoices.length > 1 ||
                    requestChoices[0]!.id.startsWith('named:') ||
                    !requestExample) && (
                    <label>
                      Request example
                      <select
                        value={requestExample}
                        onChange={(event) => {
                          const choice = requestChoices.find(
                            (item) => item.id === event.target.value,
                          );
                          if (choice) {
                            setRequestExample(choice.id);
                            setBody(formatExample(choice.value, contentType));
                          }
                        }}
                      >
                        {!requestExample && (
                          <option value="">Custom request</option>
                        )}
                        {requestChoices.map((choice) => (
                          <option key={choice.id} value={choice.id}>
                            {choice.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                {requestMedia && hasExternalExamples(requestMedia) && (
                  <p className="example-note">
                    External examples are not loaded. Local values are shown
                    here.
                  </p>
                )}
                <label>
                  Request body
                  <textarea
                    aria-label="Request body"
                    value={body}
                    spellCheck={false}
                    rows={8}
                    onChange={(event) => {
                      setRequestExample('');
                      setBody(event.target.value);
                    }}
                  />
                </label>
              </>
            )}
            {responseTypes.length > 1 && (
              <label>
                Requested response format
                <select
                  value={accept}
                  onChange={(event) => setAccept(event.target.value)}
                >
                  {responseTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
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
      </div>
      {tab === 'response' && (
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
