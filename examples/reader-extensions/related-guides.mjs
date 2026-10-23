import { heading } from './footer-tools.mjs';
export default {
  id: 'related-guides',
  version: '1.0.0',
  pluginApi: '1',
  capabilities: ['page', 'footer'],
  activate(context) {
    context.setFooter((page) => {
      const element = globalThis.document.createElement('section');
      element.append(heading('Explore this documentation'));
      const text = globalThis.document.createElement('p');
      text.textContent = `Current page: ${page.title}`;
      element.append(text);
      const link = globalThis.document.createElement('a');
      link.href = context.basePath + '/guides/next/';
      link.textContent = 'Read about extension lifecycle';
      link.setAttribute('data-doc-route', '');
      element.append(link);
      return { element };
    });
  },
};
