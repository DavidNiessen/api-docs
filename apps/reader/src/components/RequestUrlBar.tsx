import { CopyButton } from './CopyButton.js';
import { Icon } from './Icon.js';

export function RequestUrlBar({
  method,
  url,
  busy,
  disabled,
  onSend,
  onCancel,
}: {
  method: string;
  url: string;
  busy: boolean;
  disabled: boolean;
  onSend: () => void;
  onCancel: () => void;
}) {
  const target = url ? new URL(url) : undefined;
  return (
    <div className="playground-target request-url-bar">
      <span className={`method-badge ${method}`}>{method}</span>
      <code aria-label="Request URL" title={url}>
        {target ? (
          <>
            <span className="url-origin">{target.origin}</span>
            <span className="url-path">
              {target.pathname}
              {target.search}
            </span>
          </>
        ) : (
          'Complete the server and request parameters'
        )}
      </code>
      <CopyButton text={url} label="Copy request URL" disabled={!url} />
      <button
        type="button"
        className="url-send"
        aria-label="Send request"
        disabled={disabled || busy || !url}
        onClick={onSend}
      >
        <Icon name="arrow" size={14} />
        {busy ? 'Sending…' : 'Send'}
      </button>
      {busy && (
        <button type="button" className="url-cancel" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}
