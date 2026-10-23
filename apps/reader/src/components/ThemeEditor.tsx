import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  contrastRatio,
  resolvePalette,
  themePresets,
} from '@api-docs/contracts';
import type { Theme, Palette } from '@api-docs/contracts';
import { useUi } from '../ui-translation.js';
import { Icon } from './Icon.js';
export default function ThemeEditor({
  value,
  mode,
  onChange,
  onModeChange,
  onClose,
  onReset,
  children,
  personal = false,
}: {
  value: Theme;
  mode: 'light' | 'dark';
  onChange: (value: Theme) => void;
  onModeChange: (mode: 'light' | 'dark') => void;
  onClose: () => void;
  onReset: () => void;
  children?: ReactNode;
  personal?: boolean;
}) {
  const t = useUi();
  const dialog = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState<
    | 'appearance.copied'
    | 'appearance.clipboardUnavailable'
    | 'appearance.restored'
    | null
  >(null);
  const update = (theme: Theme) => {
    setMessage(null);
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
            t('appearance.contrastIssue', {
              mode: t(`color.${variant}`),
              foreground: t(`color.${foreground}`),
              background: t(`color.${background}`),
            }),
          );
  }
  useEffect(() => {
    const element = dialog.current;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    element?.showModal();
    return () => {
      element?.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  const close = () => {
    dialog.current?.close();
    onClose();
  };
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
      className={`theme-editor${personal ? ' reader-settings' : ''}`}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      aria-labelledby="theme-editor-title"
    >
      <div className="theme-editor-heading">
        <div>
          <small>
            {t(personal ? 'appearance.workspace' : 'appearance.preview')}
          </small>
          <h2 id="theme-editor-title">
            {t(personal ? 'appearance.title' : 'appearance.previewTitle')}
          </h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label={t(
            personal ? 'appearance.close' : 'appearance.closePreview',
          )}
          onClick={close}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
      <p>{personal ? t('appearance.help') : t('appearance.previewHelp')}</p>
      <div className="theme-editor-grid">
        <label>
          {t('appearance.preset')}
          <select
            value={value.preset ?? 'mint'}
            onChange={(event) => {
              const preset = event.target.value as keyof typeof themePresets;
              const next = {
                ...value,
                preset,
                accent: themePresets[preset],
              };
              if (personal) delete next.colors;
              update(next);
              setMessage(null);
            }}
          >
            {Object.keys(themePresets).map((preset) => (
              <option key={preset}>{preset}</option>
            ))}
          </select>
        </label>
        <label>
          {t(personal ? 'appearance.paletteMode' : 'appearance.previewMode')}
          <select
            value={mode}
            onChange={(event) =>
              onModeChange(event.target.value as 'light' | 'dark')
            }
          >
            <option value="light">{t('settings.light')}</option>
            <option value="dark">{t('settings.dark')}</option>
          </select>
        </label>
        <label>
          {t('appearance.accent')}
          <input
            type="color"
            value={value.accent}
            onChange={(event) =>
              update({ ...value, accent: event.target.value })
            }
          />
        </label>
        <label>
          {t('appearance.density')}
          <select
            value={value.density}
            onChange={(event) =>
              update({
                ...value,
                density: event.target.value as Theme['density'],
              })
            }
          >
            <option value="comfortable">{t('appearance.comfortable')}</option>
            <option value="compact">{t('appearance.compact')}</option>
          </select>
        </label>
        <label>
          {t('appearance.typography')}
          <select
            value={value.font}
            onChange={(event) => update({ ...value, font: event.target.value })}
          >
            <option value="system">{t('appearance.system')}</option>
            <option value="sans">{t('appearance.sans')}</option>
            <option value="serif">{t('appearance.serif')}</option>
          </select>
        </label>
        <label>
          {t('appearance.code')}
          <select
            value={value.codeTheme}
            onChange={(event) =>
              update({
                ...value,
                codeTheme: event.target.value as Theme['codeTheme'],
              })
            }
          >
            <option value="dark">{t('settings.dark')}</option>
            <option value="light">{t('settings.light')}</option>
          </select>
        </label>
      </div>
      <label>
        {t('appearance.radius', { value: value.radius })}
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
        {t('appearance.sidebarWidth', { value: value.sidebarWidth ?? 274 })}
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
        {t('appearance.readingWidth', { value: value.contentWidth ?? 760 })}
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
      <h3>
        {t('appearance.palette', {
          mode: t(mode === 'light' ? 'settings.light' : 'settings.dark'),
        })}
      </h3>
      <div className="theme-editor-grid">
        {(Object.keys(colors) as (keyof Palette)[]).map((key) => (
          <label key={key}>
            {t(`color.${key}`)}
            <input
              type="color"
              aria-label={t('appearance.color', {
                mode: t(`color.${mode}`),
                color: t(`color.${key}`),
              })}
              value={colors[key]}
              onChange={(event) => {
                setColor(key, event.target.value);
                setMessage(null);
              }}
            />
          </label>
        ))}
      </div>
      {issues.length > 0 ? (
        <div className="theme-editor-issues" role="alert">
          <strong>{t('appearance.improveContrast')}</strong>
          <p>
            {issues[0]}{' '}
            {issues.length > 1
              ? t('appearance.moreContrast', { count: issues.length - 1 })
              : ''}
          </p>
        </div>
      ) : (
        <p className="theme-editor-valid" role="status">
          {t('appearance.validContrast')}
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
              setMessage('appearance.copied');
            } catch {
              setMessage('appearance.clipboardUnavailable');
            }
          }}
        >
          {t('appearance.copy')}
        </button>
        <button
          type="button"
          onClick={() => {
            onReset();
            setMessage('appearance.restored');
          }}
        >
          {t(personal ? 'appearance.restore' : 'appearance.reset')}
        </button>
      </div>
      {message && <p role="status">{t(message)}</p>}
    </dialog>
  );
}
