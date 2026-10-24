import { hydrateRoot } from 'react-dom/client';
import { App } from './components/App.js';
import { normalizePagePath } from '@davidniessen/contracts';
import type { SiteData } from '@davidniessen/contracts';
import '../../shared/design-tokens.css';
import './styles.css';
import './island-layout.css';
import './reader-settings.css';
import './classic-reference.css';
import '../../shared/scrollbars.css';
import '../../shared/accessibility.css';
const data = document.getElementById('docs-data');
const root = document.getElementById('root');
if (data && root) {
  const site = JSON.parse(data.textContent ?? '') as SiteData;
  const path =
    site.pagePath === '/not-found/'
      ? '/not-found/'
      : normalizePagePath(
          window.location.pathname.slice(site.config.basePath.length) || '/',
        );
  hydrateRoot(root, <App site={site} initialPath={path} />);
}
