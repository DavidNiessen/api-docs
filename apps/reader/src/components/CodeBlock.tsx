import { useState } from 'react';
import { Icon } from './Icon.js';
export function CodeBlock({
  code,
  title,
  language = 'json',
}: {
  code: string;
  title?: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="code-block">
      <div className="code-toolbar">
        <span>
          <Icon name="terminal" size={14} />
          {title ?? language}
        </span>
        <button
          type="button"
          aria-label="Copy code"
          onClick={() => {
            void navigator.clipboard
              .writeText(code)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
              .catch(() =>
                setError('Clipboard unavailable. Select and copy the code.'),
              );
          }}
        >
          <Icon name={copied ? 'check' : 'copy'} size={15} />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre tabIndex={0}>
        <code>{code}</code>
      </pre>
      {error && <span role="status">{error}</span>}
    </div>
  );
}
