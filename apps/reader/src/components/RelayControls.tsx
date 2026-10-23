import type { useRelay } from '../use-relay.js';

export function RelayControls({
  relay,
  busy,
  onChange,
}: {
  relay: ReturnType<typeof useRelay>;
  busy: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="relay-controls">
      <label>
        Send requests from
        <select
          aria-label="Request transport"
          value={relay.enabled ? 'relay' : 'browser'}
          disabled={busy}
          onChange={(event) => onChange(event.target.value === 'relay')}
        >
          <option value="browser">Browser</option>
          <option value="relay">Documentation server</option>
        </select>
      </label>
      {relay.enabled && (
        <p className="relay-notice">
          Your API credentials and request payload pass through this
          documentation server. Your documentation session authorizes relay
          access.
        </p>
      )}
      {relay.checking && <p role="status">Checking relay access…</p>}
      {relay.error && (
        <div>
          <p role="alert">{relay.error}</p>
          <button
            type="button"
            className="auth-action"
            onClick={() => relay.select(true)}
          >
            Check relay access again
          </button>
        </div>
      )}
    </div>
  );
}
