import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { emptyCredentials } from './credential-session.js';
import type {
  CredentialScope,
  CredentialSession,
  CredentialValue,
  CredentialValues,
} from './credential-session.js';

const noSubscription = () => () => {};
const zero = () => 0;
export function useCredentials(
  session: CredentialSession | undefined,
  scope: CredentialScope,
) {
  useSyncExternalStore(
    session?.subscribe ?? noSubscription,
    session?.getRevision ?? zero,
    zero,
  );
  const resetEpoch = session?.getResetEpoch() ?? 0;
  const local = useRef({
    scope,
    epoch: resetEpoch,
    values: emptyCredentials(),
  });
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const [, redraw] = useState(0);
  const [notice, setNotice] = useState<{ text: string; error?: boolean }>({
    text: '',
  });
  useEffect(() => {
    if (local.current.scope !== scope || local.current.epoch !== resetEpoch)
      local.current = {
        scope,
        epoch: resetEpoch,
        values: emptyCredentials(),
      };
  }, [scope, resetEpoch]);
  useEffect(
    () => () => {
      local.current.values = emptyCredentials();
    },
    [],
  );
  const remembered = session?.isEnabled(scope) ?? false;
  function read(): CredentialValues {
    const values = session?.isEnabled(scope)
      ? session.read(scope)
      : local.current.scope === scope &&
          local.current.epoch === (session?.getResetEpoch() ?? 0)
        ? local.current.values
        : emptyCredentials();
    const fresh = emptyCredentials();
    for (const [name, entry] of Object.entries(values))
      if (entry.expiresAt === undefined || entry.expiresAt > Date.now())
        fresh[name] = entry;
    return fresh;
  }
  function keepLocal(values: CredentialValues) {
    local.current = {
      scope,
      epoch: session?.getResetEpoch() ?? 0,
      values,
    };
    redraw((value) => value + 1);
  }
  function change(name: string, value: string, expiresAt?: number) {
    if (
      activeScope.current !== scope ||
      resetEpoch !== (session?.getResetEpoch() ?? 0)
    )
      return;
    const values = read();
    const expiry =
      expiresAt ??
      (values[name]?.value === value ? values[name]?.expiresAt : undefined);
    const entry: CredentialValue = {
      value,
      ...(expiry === undefined ? {} : { expiresAt: expiry }),
    };
    const next = Object.assign(emptyCredentials(), values, { [name]: entry });
    setNotice({ text: '' });
    if (session?.isEnabled(scope)) {
      try {
        if (session.set(scope, name, entry)) return;
      } catch (error) {
        keepLocal(next);
        session.forget(scope);
        setNotice({
          text:
            error instanceof Error
              ? error.message
              : 'This credential cannot be remembered.',
          error: true,
        });
        return;
      }
    }
    keepLocal(next);
  }
  function remember(enabled: boolean) {
    if (!session) return;
    const values = read();
    if (enabled) {
      try {
        session.remember(scope, values);
        local.current.values = emptyCredentials();
        setNotice({
          text: 'Credentials stay in this reader for up to 30 minutes, or until cleared or reloaded.',
        });
      } catch (error) {
        setNotice({
          text:
            error instanceof Error
              ? error.message
              : 'Credentials could not be remembered.',
          error: true,
        });
      }
    } else {
      keepLocal(values);
      session.forget(scope);
      setNotice({
        text: 'Saved credentials were forgotten. The current form clears when closed.',
      });
    }
  }
  function currentCredentials() {
    const result: Record<string, string> = Object.create(null) as Record<
      string,
      string
    >;
    for (const [name, entry] of Object.entries(read()))
      result[name] = entry.value;
    return result;
  }
  return {
    entries: read(),
    credentials: currentCredentials(),
    currentCredentials,
    change,
    remember,
    remembered,
    resetEpoch,
    notice,
    clearLocal: () => {
      keepLocal(emptyCredentials());
      setNotice({ text: '' });
    },
    clearAll: () => {
      local.current.values = emptyCredentials();
      session?.clearAll();
      setNotice({ text: 'All API credentials cleared.' });
      redraw((value) => value + 1);
    },
  };
}
