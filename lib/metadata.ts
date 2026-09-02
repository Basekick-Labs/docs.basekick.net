import type { Metadata } from 'next';
import { siteUrl } from '@/lib/shared';

/**
 * The product a page belongs to, derived from its first slug segment.
 * Drives the title suffix and the breadcrumb.
 */
const PRODUCTS: Record<string, string> = {
  arc: 'Arc',
  'arc-enterprise': 'Arc Enterprise',
  launchpad: 'Arc Launchpad',
};

export function productOf(slugs: string[]): { key: string; name: string } | undefined {
  const key = slugs[0];
  const name = key ? PRODUCTS[key] : undefined;
  return name ? { key, name } : undefined;
}

/**
 * Canonical URL for a page, always in the trailing-slash form.
 *
 * `page.url` comes back without a trailing slash while every emitted file and
 * rendered link carries one, so the two must be reconciled here - otherwise
 * the canonical tag and the sitemap disagree with the URL the page is served
 * at, on every page.
 */
export function canonicalUrl(pageUrl: string): string {
  const path = pageUrl.endsWith('/') ? pageUrl : `${pageUrl}/`;
  return new URL(path, siteUrl).toString();
}

/**
 * Titles carry a product-specific suffix rather than one site-wide suffix.
 *
 * Arc, Arc Enterprise and Launchpad each have an "Installation", a
 * "Configuration" and an "API Reference", so a single suffix produced 39
 * groups of pages sharing a title - indistinguishable in a search result.
 * The root layout's template stays as the fallback for non-docs pages.
 */
export function pageTitle(title: string, slugs: string[]): string {
  const product = productOf(slugs);
  return product ? `${title} | ${product.name} Documentation` : `${title} | Arc Documentation`;
}

/**
 * One social card for the whole site, not one per page. Per-page cards meant
 * 132 near-identical images and 21MB of build output to say what the page
 * title already says in the post text.
 */
const OG_IMAGE = '/img/og-docs.jpg';

interface DocsMetadataInput {
  title: string;
  description?: string;
  slugs: string[];
  pageUrl: string;
}

export function docsMetadata({
  title,
  description,
  slugs,
  pageUrl,
}: DocsMetadataInput): Metadata {
  const canonical = canonicalUrl(pageUrl);

  return {
    // absolute, so the root layout's template does not append a second suffix
    title: { absolute: pageTitle(title, slugs) },
    description,
    alternates: { canonical },
    openGraph: {
      title: pageTitle(title, slugs),
      description,
      url: canonical,
      images: OG_IMAGE,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle(title, slugs),
      description,
      images: OG_IMAGE,
    },
  };
}

/**
 * Last commit date for a content file, as an ISO string.
 * Shared with the sitemap; see the note there about not using build time.
 */
export function lastModifiedIso(relativePath: string): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { execFileSync } = require('node:child_process') as typeof import('node:child_process');
    const iso = execFileSync(
      'git',
      ['log', '-1', '--format=%cI', '--', `content/docs/${relativePath}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    return iso || undefined;
  } catch {
    return undefined;
  }
}
