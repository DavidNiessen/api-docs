import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon.js';

export function CopyButton({
  text,
  label,
  disabled = false,
}: {
  text: string;
  label: string;
  disabled?: boolean;
}) {
  const [status, setStatus] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    clearTimeout(timer.current);
    setStatus('');
  }, [text]);
  return (
    <span className="copy-action">
      <button
        type="button"
        className="icon-button"
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={async () => {
          clearTimeout(timer.current);
          try {
            await navigator.clipboard.writeText(text);
            setStatus('Copied');
            timer.current = setTimeout(() => setStatus(''), 1500);
          } catch {
            setStatus('Clipboard unavailable. Select and copy the text.');
          }
        }}
      >
        <Icon name={status === 'Copied' ? 'check' : 'copy'} size={15} />
      </button>
      <span
        className={status && status !== 'Copied' ? 'copy-error' : 'sr-only'}
        role="status"
      >
        {status}
      </span>
    </span>
  );
}
