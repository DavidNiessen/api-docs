import { expect, it } from 'vitest';
import { sanitizeGuideHtml } from '../apps/reader/src/sanitize-guide.server.js';

it('sanitizes guide HTML at the rendering boundary without executing or loading content', () => {
  const clean = sanitizeGuideHtml(
    '<h2 id="heading-safe">Safe</h2><img src="x" onerror="alert(1)"><script>alert(2)</script><svg onload="alert(3)"></svg><a href="javascript:alert(4)">Unsafe</a><style>body{display:none}</style><iframe src="https://example.test"></iframe><p style="background:url(https://example.test)">Text</p>',
  );
  expect(clean).toContain('<h2 id="heading-safe">Safe</h2>');
  expect(clean).toContain('<a>Unsafe</a>');
  for (const token of [
    'onerror',
    '<script',
    '<svg',
    '<iframe',
    '<style',
    'style=',
    'javascript:',
    'alert(',
  ])
    expect(clean.includes(token)).toBe(false);
});

it('preserves authored guide components, navigation, accessibility and code examples', () => {
  const html =
    '<aside class="callout" role="note">Note</aside><button id="component-tab" type="button" role="tab" aria-controls="component-panel" data-guide-tab="one">One</button><section id="component-panel" role="tabpanel" aria-labelledby="component-tab" hidden>Panel</section><pre tabindex="0"><code class="language-js">const safe = &quot;&lt;tag&gt;&quot;;</code></pre><a href="/docs/guide/" data-doc-route>Guide</a><a href="mailto:security@example.test">Email</a>';
  const clean = sanitizeGuideHtml(html);
  for (const token of [
    'class="callout"',
    'role="note"',
    'id="component-tab"',
    'data-guide-tab="one"',
    'aria-controls="component-panel"',
    'aria-labelledby="component-tab"',
    'hidden',
    'tabindex="0"',
    'class="language-js"',
    'data-doc-route',
    'mailto:security@example.test',
  ])
    expect(clean).toContain(token);
  expect(clean).toContain('&lt;tag&gt;');
});
