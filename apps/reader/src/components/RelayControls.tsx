import type { useRelay } from '../use-relay.js';
import { useUi } from '../ui-translation.js';

export function RelayControls({
  relay,
  busy,
  onChange,
}: {
  relay: ReturnType<typeof useRelay>;
  busy: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const t = useUi();
  return (
    <div className="relay-controls">
      <label>
        {t('relay.source')}
        <select
          aria-label={t('relay.transport')}
          value={relay.enabled ? 'relay' : 'browser'}
          disabled={busy}
          onChange={(event) => onChange(event.target.value === 'relay')}
        >
          <option value="browser">{t('relay.browser')}</option>
          <option value="relay">{t('relay.server')}</option>
        </select>
      </label>
      {relay.enabled && <p className="relay-notice">{t('relay.notice')}</p>}
      {relay.checking && <p role="status">{t('relay.checking')}</p>}
      {relay.error && (
        <div>
          <p role="alert">{relay.error}</p>
          <button
            type="button"
            className="auth-action"
            onClick={() => relay.select(true)}
          >
            {t('relay.retry')}
          </button>
        </div>
      )}
    </div>
  );
}
