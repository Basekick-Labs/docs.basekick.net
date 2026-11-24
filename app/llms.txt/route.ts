import type { Folder, Item, Node } from 'fumadocs-core/page-tree';
import { siteUrl } from '@/lib/shared';
import { getPageMarkdownUrl, source } from '@/lib/source';

export const revalidate = false;

// Written by hand instead of with fumadocs' `llms(source).index()`, which
// emits a generic "# Docs" title, site-relative links to the HTML pages, and
// one extra entry per sidebar alias ("[Overview](/arc/installation/)" in a
// meta.json). An agent usually reads this file out of context, so: links are
// absolute, they point at the Markdown rendition of each page, and each
// product is an H2 section as the llms.txt format expects.

const TAB = '  ';

/** One line per entry: a folded YAML description would break the list. */
function oneLine(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function link(label: string, url: string): string {
  const text = oneLine(label).replace(/([[\]])/g, '\\$1');
  // A bare parenthesis would end the Markdown link target early.
  const target = url.replace(/\(/g, '%28').replace(/\)/g, '%29');
  return `[${text}](${target})`;
}

function listItem(indent: number, label: string, description?: string): string {
  const text = oneLine(description);
  return `${TAB.repeat(indent)}- ${label}${text ? `: ${text}` : ''}`;
}

type DocsPage = NonNullable<ReturnType<typeof source.getNodePage>>;

function pageItem(page: DocsPage, indent: number): string {
  const url = siteUrl + getPageMarkdownUrl(page).url;
  return listItem(indent, link(page.data.title, url), page.data.description);
}

/**
 * A page-tree item as a list entry, or null when it should be left out.
 *
 * Items with no page behind them are links written into a meta.json. A
 * site-relative one ("[Overview](/arc/installation/)") is a second sidebar
 * entry for a page that is already listed at its own position in the tree,
 * so it is dropped. A link to another site is kept.
 */
function renderItem(item: Item, indent: number): string | null {
  const page = source.getNodePage(item);
  if (page) return pageItem(page, indent);

  if (/^https?:\/\//.test(item.url) && typeof item.name === 'string') {
    return listItem(indent, link(item.name, item.url));
  }
  return null;
}

/**
 * The folder's own page. fumadocs sets `folder.index` unless the meta.json
 * lists "index" in `pages`, in which case the index page is an ordinary child
 * instead; find it there so the folder still renders as one linked entry.
 */
function splitIndex(folder: Folder): { index: Item | undefined; children: Node[] } {
  if (folder.index) return { index: folder.index, children: folder.children };
  const own = folder.children.find(
    (child): child is Item =>
      child.type === 'page' && /(^|\/)index\.mdx?$/.test(source.getNodePage(child)?.path ?? ''),
  );
  return { index: own, children: folder.children.filter((child) => child !== own) };
}

function folderTitle(folder: Folder): string {
  const title = source.getNodeMeta(folder)?.data.title;
  if (title) return title;
  return typeof folder.name === 'string' ? folder.name : '';
}

function renderNode(node: Node, indent: number): string[] {
  if (node.type === 'separator') return [];
  if (node.type === 'page') {
    const line = renderItem(node, indent);
    return line ? [line] : [];
  }

  // A folder's index page stands in for the folder itself, so the section
  // name is not listed twice. A folder with no page of its own is a sidebar
  // grouping only: its children are listed in its place, because a bullet
  // with no link is not valid in the llms.txt format (the reference parser,
  // llms_txt.parse_llms_file, raises on one).
  const { index, children } = splitIndex(node);
  const head = index ? renderItem(index, indent) : null;
  const nested = children.flatMap((child) =>
    renderNode(child, head ? indent + 1 : indent),
  );
  return head ? [head, ...nested] : nested;
}

function renderSection(folder: Folder): string[] {
  const { index, children } = splitIndex(folder);
  const head = index ? renderItem(index, 0) : null;
  const entries = [
    ...(head ? [head] : []),
    ...children.flatMap((child) => renderNode(child, 0)),
  ];
  if (entries.length === 0) return [];
  return [`## ${folderTitle(folder)}`, '', ...entries, ''];
}

export function GET() {
  const tree = source.getPageTree();
  const sections: string[] = [];
  const loose: string[] = [];

  for (const node of tree.children) {
    if (node.type === 'folder') sections.push(...renderSection(node));
    else loose.push(...renderNode(node, 0));
  }

  const out = [
    '# Arc documentation',
    '',
    '> Arc is an open, SQL-native time-series database on Parquet and object storage. These docs cover Arc OSS, Arc Enterprise, Arc Launchpad (the web UI) and arcli (the command line).',
    '',
    `Every link below is the Markdown source of one page. The same page in HTML is at the path between \`/llms.mdx\` and \`/content.md\`, with a trailing slash: ${siteUrl}/llms.mdx/arc/installation/content.md is ${siteUrl}/arc/installation/. The whole corpus as one Markdown file is at ${siteUrl}/llms-full.txt.`,
    '',
    ...sections,
    ...(loose.length > 0 ? ['## Other', '', ...loose, ''] : []),
  ];

  // The static export writes only the body, so in production the type and
  // charset come from the /llms.txt location in nginx.conf. This header is
  // what `next dev` serves.
  return new Response(out.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
