import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import type { Element, Root } from 'hast';
import { confinedPath, parseSource } from '@api-docs/spec';
import { slugify } from '@api-docs/contracts';
import type { Guide } from '@api-docs/contracts';

const nodeText = (node: {
  type: string;
  value?: string;
  children?: unknown[];
}): string =>
  node.type === 'text'
    ? (node.value ?? '')
    : (node.children ?? [])
        .map((child) => nodeText(child as typeof node))
        .join('');
export async function renderMarkdown(
  source: string,
): Promise<{ html: string; headings: Guide['headings'] }> {
  const headings: Guide['headings'] = [];
  const used = new Set<string>();
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(() => (tree: Root) => {
      visit(tree, 'element', (node: Element) => {
        if (/^h[1-6]$/.test(node.tagName)) {
          const text = nodeText(node);
          let id = `heading-${slugify(text)}`;
          let count = 2;
          while (used.has(id)) id = `heading-${slugify(text)}-${count++}`;
          used.add(id);
          node.properties.id = id;
          headings.push({ id, text, level: Number(node.tagName.slice(1)) });
        }
      });
    })
    .use(rehypeSanitize, {
      ...defaultSchema,
      clobberPrefix: '',
      attributes: {
        ...defaultSchema.attributes,
        '*': ['className'],
        h1: ['id'],
        h2: ['id'],
        h3: ['id'],
        h4: ['id'],
        h5: ['id'],
        h6: ['id'],
        code: [['className', /^language-./]],
      },
    })
    .use(rehypeStringify)
    .process(source);
  return { html: String(result), headings };
}
export async function loadGuides(
  root: string,
  directory: string,
): Promise<Guide[]> {
  const guides: Guide[] = [];
  const walk = async (path: string): Promise<void> => {
    let children;
    try {
      children = await readdir(path, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
      if (child.name.startsWith('.')) continue;
      const file = await confinedPath(root, resolve(path, child.name));
      if (child.isDirectory()) {
        await walk(file);
        continue;
      }
      if (!child.name.endsWith('.md')) continue;
      const raw = await readFile(file, 'utf8');
      if (Buffer.byteLength(raw) > 2 * 1024 * 1024)
        throw new Error(`Guide exceeds 2 MiB: ${file}`);
      const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(raw);
      const metadata = match
        ? (parseSource(match[1] ?? '', file) as Record<string, unknown>)
        : {};
      const source = match ? raw.slice(match[0].length) : raw;
      const slug = relative(resolve(root, directory), file)
        .replace(/\.md$/, '')
        .split(/[\\/]/)
        .map(slugify)
        .join('/');
      const rendered = await renderMarkdown(source);
      guides.push({
        order: typeof metadata.order === 'number' ? metadata.order : 100,
        slug,
        title:
          typeof metadata.title === 'string'
            ? metadata.title
            : (/^# (.+)$/m.exec(source)?.[1] ??
              child.name.replace(/\.md$/, '')),
        description:
          typeof metadata.description === 'string' ? metadata.description : '',
        group:
          typeof metadata.group === 'string' ? metadata.group : 'Get started',
        html: rendered.html,
        headings: rendered.headings,
        text: source
          .replace(/[#*`[\]()>]/g, '')
          .replace(/\s+/g, ' ')
          .trim(),
        source: relative(root, file),
      });
    }
  };
  await walk(resolve(root, directory));
  return guides.sort(
    (a, b) => a.order - b.order || a.title.localeCompare(b.title),
  );
}
