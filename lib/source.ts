import type { Folder, Node } from 'fumadocs-core/page-tree';
import { loader } from 'fumadocs-core/source';
import { docsContentRoute, docsRoute, siteUrl } from './shared';
import { toPlainMarkdown } from './llm-markdown.mjs';
import { defineDocs } from 'fumadocs-mdx/macro';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';

const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: docsRoute,
  source: docs.toFumadocsSource(),
  plugins: [],
});

export function getPageMarkdownUrl(page: (typeof source)['$inferPage']) {
  const segments = [...page.slugs, 'content.md'];

  return {
    segments,
    url: '/' + [page.locale, ...docsContentRoute.split('/'), ...segments].filter(Boolean).join('/'),
  };
}

export async function getLLMText(page: (typeof source)['$inferPage']) {
  const [processed, raw] = await Promise.all([
    page.data.getText('processed'),
    page.data.getText('raw'),
  ]);

  // Absolute and with the trailing slash: this text is read out of context
  // (per-page Markdown, the llms-full files), and the un-slashed path is a 301.
  const pageUrl = `${siteUrl}${page.url.replace(/\/$/, '')}/`;

  return `# ${page.data.title} (${pageUrl})

${toPlainMarkdown(processed, { siteUrl, pageUrl, raw }).trim()}`;
}

type DocsPage = (typeof source)['$inferPage'];

/** Every page under a page-tree node, in sidebar order, each once. */
function pagesInOrder(node: Node, seen = new Set<string>()): DocsPage[] {
  if (node.type === 'separator') return [];
  if (node.type === 'page') {
    const page = source.getNodePage(node);
    if (!page || seen.has(page.url)) return [];
    seen.add(page.url);
    return [page];
  }
  return [
    ...(node.index ? pagesInOrder(node.index, seen) : []),
    ...node.children.flatMap((child) => pagesInOrder(child, seen)),
  ];
}

/** "arc/meta.json" -> "arc": a root folder's directory is the product's URL prefix. */
export function getProductSlug(folder: Folder): string | undefined {
  return source.getNodeMeta(folder)?.path.split('/')[0];
}

/**
 * The products the docs are split into, one per root folder of the page tree,
 * with their pages in the order the sidebar shows them. Used for the
 * llms-full files, so they read in the order the docs are meant to be read.
 */
export function getProducts() {
  return source.getPageTree().children.flatMap((node) => {
    if (node.type !== 'folder') return [];
    const slug = getProductSlug(node);
    if (!slug) return [];
    const title = source.getNodeMeta(node)?.data.title ?? slug;
    return [{ slug, title, pages: pagesInOrder(node) }];
  });
}

export function getProductFullTextUrl(slug: string) {
  return `${siteUrl}/llms-full/${slug}.txt`;
}
