import { useUi } from '../ui-translation.js';
import type { ReaderPreferences } from '../reader-preferences.js';
export function ReaderSettingsControls({
  value,
  onChange,
  stored,
}: {
  value: ReaderPreferences;
  onChange: (value: ReaderPreferences) => void;
  stored: boolean;
}) {
  const t = useUi();
  const change = (update: Partial<ReaderPreferences>) =>
    onChange({ ...value, ...update });
  return (
    <section
      className="reader-settings-controls"
      aria-label={t('settings.region')}
    >
      <p className="settings-privacy">
        {stored ? t('settings.saved') : t('settings.unavailable')}
      </p>
      <div className="reader-settings-grid">
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
          {t('appearance.preset')}
          <select
            value={value.theme}
            onChange={(event) =>
              change({
                theme: event.target.value as ReaderPreferences['theme'],
              })
            }
          >
            <option value="published">{t('appearance.restore')}</option>
            <option value="mint">Mint</option>
            <option value="ocean">Ocean</option>
            <option value="violet">Violet</option>
            <option value="neutral">Neutral</option>
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
      </div>
      <p className="settings-description">{t('settings.layoutHelp')}</p>
    </section>
  );
}
