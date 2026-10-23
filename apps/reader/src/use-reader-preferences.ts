import { createContext, useEffect, useState } from 'react';
import {
  defaultReaderPreferences,
  parseReaderPreferences,
  readerPreferencesKey,
} from './reader-preferences.js';
import type { ReaderPreferences } from './reader-preferences.js';

export const EditorPreferencesContext = createContext<{
  preferences: ReaderPreferences;
  mode: 'light' | 'dark';
}>({
  preferences: defaultReaderPreferences(),
  mode: 'light' as 'light' | 'dark',
});
export function useReaderPreferences(basePath: string) {
  const [preferences, setPreferences] = useState(defaultReaderPreferences);
  const [ready, setReady] = useState(false);
  const [stored, setStored] = useState(true);
  const [systemDark, setSystemDark] = useState(false);
  const key = readerPreferencesKey(basePath);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const syncSystem = () => setSystemDark(media.matches);
    syncSystem();
    media.addEventListener('change', syncSystem);
    const read = () => {
      try {
        const source = localStorage.getItem(key);
        const next = parseReaderPreferences(source);
        if (!source) {
          const legacy = localStorage.getItem('api-docs-theme');
          if (legacy === 'light' || legacy === 'dark') next.mode = legacy;
        }
        setPreferences(next);
      } catch {
        setStored(false);
      }
      setReady(true);
    };
    read();
    const syncStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) read();
    };
    window.addEventListener('storage', syncStorage);
    return () => {
      media.removeEventListener('change', syncSystem);
      window.removeEventListener('storage', syncStorage);
    };
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(key, JSON.stringify(preferences));
      setStored(true);
    } catch {
      setStored(false);
    }
  }, [preferences, key, ready]);
  const mode =
    preferences.mode === 'system'
      ? systemDark
        ? 'dark'
        : 'light'
      : preferences.mode;
  return { preferences, setPreferences, mode, stored, ready };
}
