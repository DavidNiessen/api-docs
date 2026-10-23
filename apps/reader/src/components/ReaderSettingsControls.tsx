import { useState } from 'react';
import { useUi } from '../ui-translation.js';
import type { Theme } from '@api-docs/contracts';
import { editorContrastIssues, personalTheme } from '../reader-preferences.js';
import type {
  EditorPalette,
  ReaderPreferences,
} from '../reader-preferences.js';

export function ReaderSettingsControls({
  value,
  onChange,
  theme,
  stored,
}: {
  value: ReaderPreferences;
  onChange: (value: ReaderPreferences) => void;
  theme: Theme;
  stored: boolean;
}) {
  const t = useUi();
  const [name, setName] = useState(() => t('settings.defaultName'));
  const change = (update: Partial<ReaderPreferences>) =>
    onChange({ ...value, ...update });
  const issues = editorContrastIssues(value.editorColors);
  return (
    <section
      className="reader-settings-controls"
      aria-label={t('settings.region')}
    >
      <p className="settings-privacy">
        {stored ? t('settings.saved') : t('settings.unavailable')}
      </p>
      <div className="theme-editor-grid">
        <label>
          {t('settings.mode')}
          <select
            value={value.mode}
            onChange={(event) =>
              change({ mode: event.target.value as ReaderPreferences['mode'] })
            }
          >
            <option value="system">{t('settings.system')}</option>
            <option value="light">{t('settings.light')}</option>
            <option value="dark">{t('settings.dark')}</option>
          </select>
        </label>
        <label>
          {t('settings.layout')}
          <select
            value={value.layout}
            onChange={(event) =>
              change({
                layout: event.target.value as ReaderPreferences['layout'],
              })
            }
          >
            <option value="modern">{t('settings.modern')}</option>
            <option value="classic">{t('settings.classic')}</option>
          </select>
        </label>
        <label>
          {t('settings.editorTheme')}
          <select
            value={value.editorTheme}
            onChange={(event) =>
              change({
                editorTheme: event.target
                  .value as ReaderPreferences['editorTheme'],
              })
            }
          >
            <option value="auto">{t('settings.follow')}</option>
            <option value="light">{t('settings.light')}</option>
            <option value="dark">{t('settings.dark')}</option>
            <option value="contrast">{t('settings.contrast')}</option>
            <option value="custom">{t('settings.custom')}</option>
          </select>
        </label>
      </div>
      <p className="settings-description">{t('settings.layoutHelp')}</p>
      {value.editorTheme === 'custom' && (
        <fieldset className="editor-palette-settings">
          <legend>{t('settings.editorPalette')}</legend>
          <div className="theme-editor-grid">
            {(Object.keys(value.editorColors) as (keyof EditorPalette)[]).map(
              (key) => (
                <label key={key}>
                  {t(`color.${key}`)}
                  <input
                    type="color"
                    aria-label={t('settings.editorColor', {
                      color: t(`color.${key}`),
                    })}
                    value={value.editorColors[key]}
                    onChange={(event) =>
                      change({
                        editorColors: {
                          ...value.editorColors,
                          [key]: event.target.value,
                        },
                      })
                    }
                  />
                </label>
              ),
            )}
          </div>
          <pre
            className="editor-palette-preview"
            role="region"
            tabIndex={0}
            aria-label={t('settings.editorPreview')}
            style={{
              background: value.editorColors.background,
              color: value.editorColors.foreground,
            }}
          >
            <code>
              {'{\n  '}
              <span style={{ color: value.editorColors.key }}>"message"</span>
              {': '}
              <span style={{ color: value.editorColors.string }}>
                "Hello, world"
              </span>
              {',\n  '}
              <span style={{ color: value.editorColors.key }}>"count"</span>
              {': '}
              <span style={{ color: value.editorColors.number }}>42</span>
              {',\n  '}
              <span style={{ color: value.editorColors.key }}>"ready"</span>
              {': '}
              <span style={{ color: value.editorColors.keyword }}>true</span>
              {'\n}'}
            </code>
          </pre>
          {issues.length > 0 && (
            <p role="status" className="theme-editor-issues">
              {t('settings.editorContrast', {
                colors: issues.map((key) => t(`color.${key}`)).join(', '),
              })}
            </p>
          )}
        </fieldset>
      )}
      <h3>{t('settings.savedThemes')}</h3>
      <div className="saved-theme-form">
        <label>
          {t('settings.name')}
          <input
            maxLength={40}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="settings-save-theme"
          disabled={
            !name.trim() ||
            (value.savedThemes.length >= 8 &&
              !value.savedThemes.some((entry) => entry.name === name.trim()))
          }
          onClick={() => {
            const saved = personalTheme(theme);
            if (!saved) return;
            const next = value.savedThemes.filter(
              (entry) => entry.name !== name.trim(),
            );
            change({
              savedThemes: [...next, { name: name.trim(), theme: saved }],
            });
          }}
        >
          {t('settings.save')}
        </button>
      </div>
      <ul className="saved-theme-list">
        {value.savedThemes.map((saved) => (
          <li key={saved.name}>
            <button
              type="button"
              onClick={() => change({ theme: saved.theme })}
            >
              {t('settings.apply', { name: saved.name })}
            </button>
            <button
              type="button"
              aria-label={t('settings.deleteLabel', { name: saved.name })}
              onClick={() =>
                change({
                  savedThemes: value.savedThemes.filter(
                    (entry) => entry !== saved,
                  ),
                })
              }
            >
              {t('settings.delete')}
            </button>
          </li>
        ))}
      </ul>
      <p className="settings-description">{t('settings.saveHelp')}</p>
    </section>
  );
}
