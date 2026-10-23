import { confinedPath } from '@api-docs/spec';
import { loadGuides } from '@api-docs/content';
import type { GuideReadBudget } from '@api-docs/content';
import { validateGuideTranslations } from '@api-docs/contracts';
import type { SiteData } from '@api-docs/contracts';
export async function loadTranslatedGuides(
  root: string,
  site: SiteData,
  trustContent: boolean,
  budget: GuideReadBudget,
): Promise<void> {
  const roots = Object.entries(site.config.i18n?.guides ?? {});
  if (!roots.length) return;
  const translations: NonNullable<SiteData['guideTranslations']> = {};
  for (const [locale, directory] of roots) {
    await confinedPath(root, directory);
    translations[locale] = await loadGuides(root, directory, {
      trustContent,
      basePath: site.config.basePath,
      localePrefix: '/' + locale,
      budget,
    });
  }
  site.guideTranslations = translations;
  validateGuideTranslations(site);
}
