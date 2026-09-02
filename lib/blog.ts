/**
 * Latest posts from the Basekick Labs blog, read at build time.
 *
 * Static export means this runs once per build, so the homepage refreshes
 * whenever the docs deploy. Two constraints shape everything here:
 *
 * 1. A feed failure must never fail the build. The docs shipping is more
 *    important than the blog section rendering, so every path returns [] and
 *    the section hides itself.
 * 2. The feed is third-party content being injected into our HTML. Titles and
 *    descriptions are treated as untrusted text, and links are restricted to
 *    https: URLs on the expected host.
 */

const FEED_URL = 'https://basekick.net/feed.xml';
const ALLOWED_HOST = 'basekick.net';

export interface BlogPost {
  title: string;
  url: string;
  date: string;
  description: string;
}

function decodeEntities(input: string): string {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** Unwrap CDATA, strip any markup, collapse whitespace. */
function text(raw: string | undefined): string {
  if (!raw) return '';
  const unwrapped = raw.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');
  return decodeEntities(unwrapped.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

/** Only https links to the blog's own host survive. */
function safeUrl(raw: string | undefined): string | null {
  const candidate = text(raw);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:') return null;
    if (url.hostname !== ALLOWED_HOST && !url.hostname.endsWith(`.${ALLOWED_HOST}`)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function tag(item: string, name: string): string | undefined {
  return new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(item)?.[1];
}

export async function getLatestPosts(limit = 3): Promise<BlogPost[]> {
  let xml: string;
  try {
    const res = await fetch(FEED_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.warn(`[blog] feed returned ${res.status}; homepage will omit the blog section`);
      return [];
    }
    xml = await res.text();
  } catch (error) {
    console.warn('[blog] feed unreachable; homepage will omit the blog section:', error);
    return [];
  }

  try {
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    const posts: BlogPost[] = [];

    for (const item of items) {
      const url = safeUrl(tag(item, 'link'));
      const title = text(tag(item, 'title'));
      if (!url || !title) continue;

      const pubDate = text(tag(item, 'pubDate'));
      const parsed = pubDate ? new Date(pubDate) : null;

      posts.push({
        title,
        url,
        date:
          parsed && !Number.isNaN(parsed.getTime())
            ? parsed.toISOString().slice(0, 10)
            : '',
        description: text(tag(item, 'description')),
      });

      if (posts.length === limit) break;
    }

    return posts;
  } catch (error) {
    console.warn('[blog] feed could not be parsed:', error);
    return [];
  }
}
