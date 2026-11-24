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
  const processed = await page.data.getText('processed');

  // Absolute and with the trailing slash: this text is read out of context
  // (per-page Markdown, the llms-full files), and the un-slashed path is a 301.
  return `# ${page.data.title} (${siteUrl}${page.url.replace(/\/$/, '')}/)

${toPlainMarkdown(processed, siteUrl).trim()}`;
}

/**
 * The products the docs are split into, in sidebar order: one per root folder
 * of the page tree. Used for the per-product llms-full files.
 */
export function getProducts() {
  return source.getPageTree().children.flatMap((node) => {
    if (node.type !== 'folder') return [];
    // "arc/meta.json" -> "arc": the directory is the product's URL prefix.
    const meta = source.getNodeMeta(node);
    const slug = meta?.path.split('/')[0];
    if (!meta || !slug) return [];
    const pages = source.getPages().filter((page) => page.slugs[0] === slug);
    return [{ slug, title: meta.data.title ?? slug, pages }];
  });
}

export function getProductFullTextUrl(slug: string) {
  return `${siteUrl}/llms-full/${slug}.txt`;
}
