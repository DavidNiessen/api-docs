import { CopyButton } from './CopyButton.js';
import { useUi } from '../ui-translation.js';
import { Icon } from './Icon.js';

export function RequestUrlBar({
  method,
  url,
  busy,
  disabled,
  mockOnly = false,
  onSend,
  onCancel,
}: {
  method: string;
  url: string;
  busy: boolean;
  disabled: boolean;
  mockOnly?: boolean;
  onSend: () => void;
  onCancel: () => void;
}) {
  const t = useUi();
  const target = url ? new URL(url) : undefined;
  return (
    <div className="playground-target request-url-bar">
      <span className={`method-badge ${method}`}>{method}</span>
      <code tabIndex={0} aria-label={t('playground.requestUrl')} title={url}>
        {target ? (
          <>
            <span className="url-origin">{target.origin}</span>
            <span className="url-path">
              {target.pathname}
              {target.search}
            </span>
          </>
        ) : (
          t('playground.incompleteUrl')
        )}
      </code>
      <CopyButton text={url} label={t('playground.copyUrl')} disabled={!url} />
      <button
        type="button"
        className="url-send"
        aria-label={t(
          mockOnly ? 'playground.mockSendLabel' : 'playground.sendLabel',
        )}
        disabled={disabled || busy || !url}
        onClick={onSend}
      >
        <Icon name="arrow" size={14} />
        {t(
          busy
            ? 'playground.sending'
            : mockOnly
              ? 'playground.mockSend'
              : 'playground.send',
        )}
      </button>
      {busy && (
        <button type="button" className="url-cancel" onClick={onCancel}>
          {t('playground.cancel')}
        </button>
      )}
    </div>
  );
}
