import { useEffect, useState } from 'react';
import { loadRelayPolicy, RelayError } from './relay-transport.js';
import type { ReaderRelayPolicy } from './relay-transport.js';
import type { RelayErrorCode } from './relay-transport.js';
import { useUi } from './ui-translation.js';
import { relayErrorText } from './auth-messages.js';

export function useRelay(path: string | undefined, active: boolean) {
  const t = useUi();
  const [selection, setSelection] = useState({
    path,
    enabled: false,
    revision: 0,
  });
  const [result, setResult] = useState<{
    selection: typeof selection;
    policy?: ReaderRelayPolicy;
    error?: RelayErrorCode | 'unavailable';
  }>();
  const enabled =
    active && !!path && selection.path === path && selection.enabled;
  const current = result?.selection === selection ? result : undefined;
  useEffect(() => {
    setSelection({ path, enabled: false, revision: 0 });
  }, [path]);
  useEffect(() => {
    if (!enabled || !path) return;
    const controller = new AbortController();
    void loadRelayPolicy(path, controller.signal).then(
      (policy) => {
        if (!controller.signal.aborted) setResult({ selection, policy });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            selection,
            error: error instanceof RelayError ? error.code : 'unavailable',
          });
      },
    );
    return () => controller.abort();
  }, [enabled, path, selection]);
  return {
    enabled,
    policy: enabled ? current?.policy : undefined,
    error:
      enabled && current?.error ? relayErrorText(current.error, t) : undefined,
    checking: enabled && !current,
    select: (enabled: boolean) =>
      setSelection((previous) => ({
        path,
        enabled,
        revision: previous.revision + 1,
      })),
  };
}
