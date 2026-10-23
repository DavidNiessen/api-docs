import { useEffect, useState } from 'react';
import { loadRelayPolicy, RelayError } from './relay-transport.js';
import type { ReaderRelayPolicy } from './relay-transport.js';

export function useRelay(path: string | undefined, active: boolean) {
  const [selection, setSelection] = useState({
    path,
    enabled: false,
    revision: 0,
  });
  const [result, setResult] = useState<{
    selection: typeof selection;
    policy?: ReaderRelayPolicy;
    error?: string;
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
            error:
              error instanceof RelayError
                ? error.message
                : 'The documentation server relay is unavailable. Check your connection and sign-in, then check access again.',
          });
      },
    );
    return () => controller.abort();
  }, [enabled, path, selection]);
  return {
    enabled,
    policy: enabled ? current?.policy : undefined,
    error: enabled ? current?.error : undefined,
    checking: enabled && !current,
    select: (enabled: boolean) =>
      setSelection((previous) => ({
        path,
        enabled,
        revision: previous.revision + 1,
      })),
  };
}
