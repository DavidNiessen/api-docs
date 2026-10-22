import { Children, createElement as h, isValidElement, useId } from 'react';
import type { ReactNode, ReactElement } from 'react';
type Content = { children?: ReactNode };
type Titled = Content & { title?: string };
export function Tab({ children }: Titled): ReactNode {
  return children;
}
export function Tabs({ children }: Content) {
  const group = 'component-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const tabs = Children.toArray(children).filter(
    isValidElement,
  ) as ReactElement<Titled>[];
  if (!tabs.length || tabs.some((child) => child.type !== Tab))
    throw new Error('Tabs requires Tab children');
  return h(
    'div',
    { className: 'content-tabs' },
    h(
      'div',
      { role: 'tablist', 'aria-label': 'Example languages' },
      ...tabs.map((tab, index) =>
        h(
          'button',
          {
            key: index,
            type: 'button',
            role: 'tab',
            id: `${group}-tab-${index}`,
            'aria-selected': index === 0,
            'aria-controls': `${group}-panel-${index}`,
            tabIndex: index === 0 ? 0 : -1,
            'data-guide-tab': 'true',
          },
          tab.props.title ?? `Tab ${index + 1}`,
        ),
      ),
    ),
    ...tabs.map((tab, index) =>
      h(
        'section',
        {
          key: index,
          role: 'tabpanel',
          id: `${group}-panel-${index}`,
          'aria-labelledby': `${group}-tab-${index}`,
          tabIndex: 0,
        },
        tab.props.children,
      ),
    ),
  );
}
export function Callout({
  children,
  title,
  type = 'info',
}: Titled & { type?: 'info' | 'warning' | 'tip' | 'danger' }) {
  if (!['info', 'warning', 'tip', 'danger'].includes(type))
    throw new Error('Invalid callout type');
  return h(
    'aside',
    { className: `content-callout ${type}`, role: 'note' },
    title && h('strong', null, title),
    children,
  );
}
export function Steps({ children }: Content) {
  return h('ol', { className: 'content-steps' }, children);
}
export function Step({ children, title }: Titled) {
  return h('li', null, title && h('strong', null, title), children);
}
export function Accordion({ children, title = 'Details' }: Titled) {
  return h(
    'details',
    { className: 'content-accordion' },
    h('summary', null, title),
    children,
  );
}
export function CardGroup({ children }: Content) {
  return h('div', { className: 'content-cards' }, children);
}
function safeHref(href: string): string {
  if (
    /^\/(?!\/)/.test(href) ||
    /^https:\/\//.test(href) ||
    /^#[a-zA-Z0-9_-]+$/.test(href)
  )
    return href;
  throw new Error(
    'Component links require a local absolute path, heading anchor or HTTPS URL',
  );
}
export function Card({ children, title, href }: Titled & { href: string }) {
  return h(
    'a',
    { className: 'content-card', href: safeHref(href) },
    h('strong', null, title),
    children,
  );
}
export function CodeGroup({ children }: Content) {
  return h('div', { className: 'content-code-group' }, children);
}
export function Schema({
  schema,
  title = 'Schema',
}: {
  schema: unknown;
  title?: string;
}) {
  return h(
    'figure',
    { className: 'content-schema' },
    h('figcaption', null, title),
    h('pre', null, h('code', null, JSON.stringify(schema, null, 2))),
  );
}
export function guideComponents(basePath: string) {
  const ApiLink = ({ href, children }: Content & { href: string }) =>
    h(
      'a',
      {
        'data-doc-route': 'true',
        href: href.startsWith('/') ? basePath + safeHref(href) : safeHref(href),
      },
      children,
    );
  const SiteCard = (props: Parameters<typeof Card>[0]) =>
    h(Card, {
      ...props,
      href: props.href.startsWith('/')
        ? basePath + safeHref(props.href)
        : safeHref(props.href),
    });
  return {
    Tabs,
    Tab,
    Callout,
    Steps,
    Step,
    Accordion,
    Card: SiteCard,
    CardGroup,
    CodeGroup,
    Schema,
    ApiLink,
  };
}
