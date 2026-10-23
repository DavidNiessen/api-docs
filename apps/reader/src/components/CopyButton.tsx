import { useEffect, useRef, useState } from 'react';
import { useUi } from '../ui-translation.js';
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
  const t = useUi();
  const [status, setStatus] = useState<'' | 'copied' | 'error'>('');
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
            setStatus('copied');
            timer.current = setTimeout(() => setStatus(''), 1500);
          } catch {
            setStatus('error');
          }
        }}
      >
        <Icon name={status === 'copied' ? 'check' : 'copy'} size={15} />
      </button>
      <span
        className={status && status !== 'copied' ? 'copy-error' : 'sr-only'}
        role="status"
      >
        {status
          ? t(status === 'copied' ? 'copy.success' : 'copy.unavailable')
          : ''}
      </span>
    </span>
  );
}
