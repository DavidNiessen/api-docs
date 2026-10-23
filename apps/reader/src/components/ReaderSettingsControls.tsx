import { useState } from 'react';
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
  const [name, setName] = useState('My theme');
  const change = (update: Partial<ReaderPreferences>) =>
    onChange({ ...value, ...update });
  const issues = editorContrastIssues(value.editorColors);
  return (
    <section
      className="reader-settings-controls"
      aria-label="Personal preferences"
    >
      <p className="settings-privacy">
        {stored
          ? 'Saved in this browser for this documentation site. Your settings do not change the published project.'
          : 'Browser storage is unavailable. Settings work for this visit.'}
      </p>
      <div className="theme-editor-grid">
        <label>
          Appearance mode
          <select
            value={value.mode}
            onChange={(event) =>
              change({ mode: event.target.value as ReaderPreferences['mode'] })
            }
          >
            <option value="system">Use system setting</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label>
          Documentation layout
          <select
            value={value.layout}
            onChange={(event) =>
              change({
                layout: event.target.value as ReaderPreferences['layout'],
              })
            }
          >
            <option value="modern">Modern islands</option>
            <option value="classic">Classic API reference</option>
          </select>
        </label>
        <label>
          Response editor theme
          <select
            value={value.editorTheme}
            onChange={(event) =>
              change({
                editorTheme: event.target
                  .value as ReaderPreferences['editorTheme'],
              })
            }
          >
            <option value="auto">Follow appearance</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="contrast">High contrast</option>
            <option value="custom">Custom palette</option>
          </select>
        </label>
      </div>
      <p className="settings-description">
        Modern islands have resizable navigation and inspectors. Classic uses a
        continuous page, a compact navigation rail, and method-colored endpoint
        headings.
      </p>
      {value.editorTheme === 'custom' && (
        <fieldset className="editor-palette-settings">
          <legend>Custom editor palette</legend>
          <div className="theme-editor-grid">
            {(Object.keys(value.editorColors) as (keyof EditorPalette)[]).map(
              (key) => (
                <label key={key}>
                  {key}
                  <input
                    type="color"
                    aria-label={`Editor ${key} color`}
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
            aria-label="Editor palette preview"
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
              Editor contrast below 4.5:1: {issues.join(', ')}.
            </p>
          )}
        </fieldset>
      )}
      <h3>Saved custom themes</h3>
      <div className="saved-theme-form">
        <label>
          Theme name
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
          Save current theme
        </button>
      </div>
      <ul className="saved-theme-list">
        {value.savedThemes.map((saved) => (
          <li key={saved.name}>
            <button
              type="button"
              onClick={() => change({ theme: saved.theme })}
            >
              Apply {saved.name}
            </button>
            <button
              type="button"
              aria-label={`Delete theme ${saved.name}`}
              onClick={() =>
                change({
                  savedThemes: value.savedThemes.filter(
                    (entry) => entry !== saved,
                  ),
                })
              }
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      <p className="settings-description">
        Save up to eight palettes, typography, density and width presets. Saving
        an existing name replaces it.
      </p>
    </section>
  );
}
