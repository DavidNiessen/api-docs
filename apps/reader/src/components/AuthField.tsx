import { useEffect, useRef, useState } from 'react';
import type { SecurityScheme } from '@api-docs/contracts';
import { requestOAuthToken } from '../oauth-popup.js';
import { resolveOAuthEndpoint } from '@api-docs/explorer';

export function AuthField({
  name,
  scheme,
  credential,
  onChange,
  scopes,
  redirectUri,
  client,
  server,
}: {
  name: string;
  scheme: SecurityScheme | undefined;
  credential: string;
  onChange: (value: string) => void;
  scopes: string[];
  redirectUri: string;
  client?: { clientId: string; issuer: string } | undefined;
  server: string;
}) {
  const flow =
    scheme?.type === 'oauth2' &&
    scheme.flows?.authorizationCode &&
    typeof scheme.flows.authorizationCode === 'object'
      ? (scheme.flows.authorizationCode as Record<string, unknown>)
      : undefined;
  const [clientId, setClientId] = useState(client?.clientId ?? '');
  const [issuer, setIssuer] = useState(client?.issuer ?? '');
  const [scopeText, setScopeText] = useState(scopes.join(' '));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [status, setStatus] = useState('');
  const [expiresAt, setExpiresAt] = useState<number>();
  const pending = useRef<AbortController | null>(null),
    token = useRef<string | undefined>(undefined),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pending.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (token.current && token.current !== credential) {
      token.current = undefined;
      setExpiresAt(undefined);
      setStatus('');
    }
  }, [credential]);
  useEffect(() => {
    if (!expiresAt || !credential || token.current !== credential) return;
    let timeout: ReturnType<typeof setTimeout>;
    const check = () => {
      if (Date.now() >= expiresAt) {
        token.current = undefined;
        setExpiresAt(undefined);
        onChange('');
        setStatus('Token expired. Authorize again or paste a token.');
      } else
        timeout = setTimeout(
          check,
          Math.min(expiresAt - Date.now(), 2_147_483_647),
        );
    };
    check();
    return () => clearTimeout(timeout);
  }, [expiresAt, credential, onChange]);
  async function authorize() {
    if (
      !flow ||
      typeof flow.authorizationUrl !== 'string' ||
      typeof flow.tokenUrl !== 'string'
    )
      return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const result = await requestOAuthToken(
        {
          clientId,
          issuer,
          authorizationUrl: resolveOAuthEndpoint(flow.authorizationUrl, server),
          tokenUrl: resolveOAuthEndpoint(flow.tokenUrl, server),
          redirectUri,
          scopes: scopeText.split(/\s+/).filter(Boolean),
          allowLoopbackHttp:
            location.protocol === 'http:' &&
            ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname),
        },
        controller.signal,
      );
      if (!mounted.current || controller.signal.aborted) return;
      token.current = result.accessToken;
      setExpiresAt(result.expiresAt);
      onChange(result.accessToken);
      setStatus('Bearer token received. It stays in memory.');
    } catch (error) {
      if (mounted.current)
        setError(
          controller.signal.aborted
            ? 'Authorization cancelled.'
            : error instanceof Error
              ? error.message
              : 'Authorization failed. Check the provider, client registration and CORS settings.',
        );
    } finally {
      if (mounted.current) setBusy(false);
      if (pending.current === controller) pending.current = null;
    }
  }
  return (
    <div className="auth-field">
      <label>
        {name}
        <input
          type="password"
          autoComplete="off"
          aria-label={`${name} credential`}
          disabled={busy}
          value={credential}
          onChange={(event) => {
            setError('');
            onChange(event.target.value);
          }}
          placeholder={
            scheme?.scheme === 'basic'
              ? 'username:password'
              : 'Enter token or API key'
          }
        />
      </label>
      {credential && (
        <button
          type="button"
          className="auth-action"
          onClick={() => {
            pending.current?.abort();
            token.current = undefined;
            setExpiresAt(undefined);
            setStatus('Credentials cleared.');
            onChange('');
          }}
          aria-label={`Clear ${name} credential`}
        >
          Clear credential
        </button>
      )}
      {flow && (
        <>
          <details className="oauth-settings" open={!client}>
            <summary>OAuth public client</summary>
            <p>
              Register this callback with your provider. Public clients need
              PKCE and CORS support; never enter a client secret.
            </p>
            <label>
              Client ID
              <input
                aria-label={`${name} OAuth client ID`}
                value={clientId}
                disabled={busy}
                onChange={(event) => setClientId(event.target.value)}
                autoComplete="off"
              />
            </label>
            <label>
              Issuer
              <input
                aria-label={`${name} OAuth issuer`}
                value={issuer}
                disabled={busy}
                onChange={(event) => setIssuer(event.target.value)}
                type="url"
                autoComplete="off"
              />
            </label>
            <label>
              Scopes
              <input
                aria-label={`${name} OAuth scopes`}
                value={scopeText}
                disabled={busy}
                onChange={(event) => setScopeText(event.target.value)}
                autoComplete="off"
              />
            </label>
            <label>
              Redirect URI
              <input
                aria-label={`${name} OAuth redirect URI`}
                readOnly
                value={redirectUri}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
          </details>
          <button
            type="button"
            className="auth-action"
            disabled={busy || !clientId || !issuer || !redirectUri}
            onClick={() => {
              void authorize();
            }}
            aria-label={`Authorize ${name} with PKCE`}
          >
            {busy ? 'Waiting for authorization…' : 'Authorize with PKCE'}
          </button>
          {busy && (
            <button
              type="button"
              className="auth-action"
              onClick={() => pending.current?.abort()}
              aria-label={`Cancel ${name} authorization`}
            >
              Cancel authorization
            </button>
          )}
        </>
      )}
      {expiresAt && (
        <p>
          Expires at{' '}
          <time dateTime={new Date(expiresAt).toISOString()}>
            {new Date(expiresAt).toLocaleTimeString()}
          </time>
          .
        </p>
      )}
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
