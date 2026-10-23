import { useState } from 'react';
import { Icon } from './Icon.js';
import { useUi } from '../ui-translation.js';
export function CodeBlock({
  code,
  title,
  language = 'json',
}: {
  code: string;
  title?: string;
  language?: string;
}) {
  const t = useUi();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="code-block">
      <div className="code-toolbar">
        <span>
          <Icon name="terminal" size={14} />
          {title ?? language}
        </span>
        <button
          type="button"
          aria-label={t('code.copyLabel')}
          onClick={async () => {
            setError(false);
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              setError(true);
            }
          }}
        >
          <Icon name={copied ? 'check' : 'copy'} size={15} />
          {t(copied ? 'copy.success' : 'code.copy')}
        </button>
      </div>
      <pre tabIndex={0}>
        <code>{code}</code>
      </pre>
      {error && <span role="status">{t('code.copyUnavailable')}</span>}
    </div>
  );
}
