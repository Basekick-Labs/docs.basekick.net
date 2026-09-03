import { canonicalUrl, productOf } from '@/lib/metadata';
import { siteUrl } from '@/lib/shared';

/**
 * JSON-LD for documentation pages. Fumadocs emits none, and the Docusaurus
 * site only had a BreadcrumbList - whose URLs, incidentally, disagreed with
 * its own canonical tags. Everything here uses the same trailing-slash form
 * as the canonical.
 *
 * TechArticle is emitted only with its required properties populated; a
 * partial one is ignored by consumers and reported as an error in Search
 * Console, which is worse than omitting it.
 */

interface Crumb {
  name: string;
  url: string;
}

function breadcrumbs(slugs: string[], title: string): Crumb[] {
  const product = productOf(slugs);
  if (!product) return [];

  const crumbs: Crumb[] = [
    { name: 'Docs', url: `${siteUrl}/` },
    { name: product.name, url: canonicalUrl(`/${product.key}`) },
  ];

  // Intermediate segments, excluding the product root and the page itself.
  for (let i = 1; i < slugs.length - 1; i += 1) {
    const segment = slugs[i];
    crumbs.push({
      name: segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      url: canonicalUrl(`/${slugs.slice(0, i + 1).join('/')}`),
    });
  }

  if (slugs.length > 1) {
    crumbs.push({ name: title, url: canonicalUrl(`/${slugs.join('/')}`) });
  }

  return crumbs;
}

interface StructuredDataProps {
  title: string;
  description?: string;
  slugs: string[];
  pageUrl: string;
  lastModified?: string;
}

export function StructuredData({
  title,
  description,
  slugs,
  pageUrl,
  lastModified,
}: StructuredDataProps) {
  const url = canonicalUrl(pageUrl);
  const crumbs = breadcrumbs(slugs, title);

  const graph: Record<string, unknown>[] = [];

  if (crumbs.length > 1) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: crumb.url,
      })),
    });
  }

  // dateModified is required for TechArticle to be usable; without a real
  // date, emit only the breadcrumbs.
  if (description && lastModified) {
    graph.push({
      '@type': 'TechArticle',
      headline: title,
      description,
      url,
      dateModified: lastModified,
      inLanguage: 'en',
      author: { '@type': 'Organization', name: 'Basekick Labs', url: 'https://basekick.net' },
      publisher: {
        '@type': 'Organization',
        name: 'Basekick Labs',
        url: 'https://basekick.net',
      },
      isPartOf: { '@type': 'WebSite', name: 'Arc Documentation', url: `${siteUrl}/` },
    });
  }

  if (graph.length === 0) return null;

  return (
    <script
      type="application/ld+json"
      // Content is our own front matter, not user input.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }),
      }}
    />
  );
}
