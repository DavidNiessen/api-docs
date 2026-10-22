import { useEffect, useRef, useState } from 'react';
import {
  contrastRatio,
  resolvePalette,
  themePresets,
} from '@api-docs/contracts';
import type { Theme, Palette } from '@api-docs/contracts';
import { Icon } from './Icon.js';
export default function ThemeEditor({
  value,
  mode,
  onChange,
  onModeChange,
  onClose,
  onReset,
}: {
  value: Theme;
  mode: 'light' | 'dark';
  onChange: (value: Theme) => void;
  onModeChange: (mode: 'light' | 'dark') => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState('');
  const update = (theme: Theme) => {
    setMessage('');
    onChange(theme);
  };
  const colors = resolvePalette(value, mode);
  const issues: string[] = [];
  for (const variant of ['light', 'dark'] as const) {
    const palette = resolvePalette(value, variant);
    for (const foreground of ['text', 'muted', 'heading'] as const)
      for (const background of ['background', 'surface', 'subtle'] as const)
        if (contrastRatio(palette[foreground], palette[background]) < 4.5)
          issues.push(
            `${variant}: ${foreground} needs more contrast against ${background}.`,
          );
  }
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const setColor = (key: keyof Palette, color: string) =>
    update({
      ...value,
      colors: {
        ...value.colors,
        [mode]: { ...value.colors?.[mode], [key]: color },
      },
    });
  return (
    <dialog
      ref={dialog}
      className="theme-editor"
      onCancel={onClose}
      aria-labelledby="theme-editor-title"
    >
      <div className="theme-editor-heading">
        <div>
          <small>Live preview</small>
          <h2 id="theme-editor-title">Make it yours</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Close appearance editor"
          onClick={() => {
            dialog.current?.close();
            onClose();
          }}
        >
          <Icon name="close" />
        </button>
      </div>
      <p>
        Preview your brand across the documentation. Copy the theme section when
        it is ready.
      </p>
      <div className="theme-editor-grid">
        <label>
          Preset
          <select
            value={value.preset ?? 'mint'}
            onChange={(event) => {
              const preset = event.target.value as keyof typeof themePresets;
              update({ ...value, preset, accent: themePresets[preset] });
              setMessage('');
            }}
          >
            {Object.keys(themePresets).map((preset) => (
              <option key={preset}>{preset}</option>
            ))}
          </select>
        </label>
        <label>
          Preview mode
          <select
            value={mode}
            onChange={(event) =>
              onModeChange(event.target.value as 'light' | 'dark')
            }
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label>
          Accent
          <input
            type="color"
            value={value.accent}
            onChange={(event) =>
              update({ ...value, accent: event.target.value })
            }
          />
        </label>
        <label>
          Density
          <select
            value={value.density}
            onChange={(event) =>
              update({
                ...value,
                density: event.target.value as Theme['density'],
              })
            }
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>
        <label>
          Typography
          <select
            value={value.font}
            onChange={(event) => update({ ...value, font: event.target.value })}
          >
            <option value="system">System</option>
            <option value="sans">Sans serif</option>
            <option value="serif">Serif</option>
          </select>
        </label>
        <label>
          Code blocks
          <select
            value={value.codeTheme}
            onChange={(event) =>
              update({
                ...value,
                codeTheme: event.target.value as Theme['codeTheme'],
              })
            }
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
      </div>
      <label>
        Corner radius: {value.radius}px
        <input
          type="range"
          min={0}
          max={24}
          value={value.radius}
          onChange={(event) =>
            update({ ...value, radius: Number(event.target.value) })
          }
        />
      </label>
      <label>
        Sidebar width: {value.sidebarWidth ?? 274}px
        <input
          type="range"
          min={220}
          max={320}
          value={value.sidebarWidth ?? 274}
          onChange={(event) =>
            update({ ...value, sidebarWidth: Number(event.target.value) })
          }
        />
      </label>
      <label>
        Reading width: {value.contentWidth ?? 760}px
        <input
          type="range"
          min={600}
          max={960}
          value={value.contentWidth ?? 760}
          onChange={(event) =>
            update({ ...value, contentWidth: Number(event.target.value) })
          }
        />
      </label>
      <h3>{mode === 'light' ? 'Light' : 'Dark'} palette</h3>
      <div className="theme-editor-grid">
        {(Object.keys(colors) as (keyof Palette)[]).map((key) => (
          <label key={key}>
            {key}
            <input
              type="color"
              aria-label={`${mode} ${key} color`}
              value={colors[key]}
              onChange={(event) => {
                setColor(key, event.target.value);
                setMessage('');
              }}
            />
          </label>
        ))}
      </div>
      {issues.length > 0 ? (
        <div className="theme-editor-issues" role="alert">
          <strong>Improve contrast before exporting</strong>
          <p>
            {issues[0]}{' '}
            {issues.length > 1
              ? `${issues.length - 1} additional contrast checks need attention.`
              : ''}
          </p>
        </div>
      ) : (
        <p className="theme-editor-valid" role="status">
          Reading colors meet the 4.5:1 contrast checks.
        </p>
      )}
      <div className="theme-editor-actions">
        <button
          type="button"
          className="button-primary"
          disabled={issues.length > 0}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                JSON.stringify({ theme: value }, null, 2),
              );
              setMessage(
                'Theme copied. Merge its theme section into your project configuration.',
              );
            } catch {
              setMessage(
                'Clipboard access is unavailable. Review your browser permissions.',
              );
            }
          }}
        >
          Copy theme configuration
        </button>
        <button
          type="button"
          onClick={() => {
            onReset();
            setMessage('Published theme restored.');
          }}
        >
          Reset
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </dialog>
  );
}
