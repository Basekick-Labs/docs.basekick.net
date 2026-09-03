import type { MetadataRoute } from 'next';
import { execFileSync } from 'node:child_process';
import { source } from '@/lib/source';
import { canonicalUrl } from '@/lib/metadata';
import { siteUrl } from '@/lib/shared';

export const revalidate = false;

/**
 * Last commit date for a content file.
 *
 * Deliberately not build time: stamping every page with the build date tells
 * search engines the whole site changed on every deploy, which teaches them
 * to ignore lastmod entirely. Requires full history - a shallow clone makes
 * `git log` return nothing, so the deploy workflow checks out with
 * fetch-depth: 0.
 */
function lastModified(relativePath: string): Date | undefined {
  try {
    const iso = execFileSync(
      'git',
      ['log', '-1', '--format=%cI', '--', `content/docs/${relativePath}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    if (!iso) return undefined;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? undefined : date;
  } catch {
    return undefined;
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = source.getPages().map((page) => ({
    // canonicalUrl appends the trailing slash. page.url has none, while every
    // emitted file and rendered link does, so without this the sitemap would
    // advertise a different URL than the canonical tag on the same page.
    url: canonicalUrl(page.url),
    lastModified: lastModified(page.path),
  }));

  return [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
    },
    ...pages,
  ];
}
