/**
 * Tag outbound links to basekick.net so LaunchPulse can attribute the visit.
 *
 * The SDK keys off `utm_source`: without it the other parameters are ignored
 * and the visit falls back to referrer attribution. It lowercases `source` and
 * `medium` but stores `campaign` verbatim, so everything here is lowercase to
 * keep the reports consistent either way.
 *
 * Only ever applied to links a reader clicks. Never to:
 *   - JSON-LD `@id` / `sameAs` values, which are identifiers and must match
 *     the canonical URL exactly
 *   - the RSS feed URL, which is fetched at build time by us, not visited
 */

const SITE = 'basekick.net';

export const UTM_SOURCE = 'docs';
export const UTM_MEDIUM = 'referral';

/**
 * @param url      absolute basekick.net URL
 * @param campaign what part of the docs the link sits in, e.g. 'nav',
 *                 'homepage', 'benchmarks'. Shows up as the campaign in
 *                 LaunchPulse, so keep the vocabulary small and stable.
 */
export function withUtm(url: string, campaign: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  // Leave anything that is not basekick.net alone, and never touch
  // docs.basekick.net - that is this site.
  if (parsed.hostname !== SITE && parsed.hostname !== `www.${SITE}`) return url;

  // Respect a URL that already carries attribution.
  if (parsed.searchParams.has('utm_source')) return url;

  parsed.searchParams.set('utm_source', UTM_SOURCE);
  parsed.searchParams.set('utm_medium', UTM_MEDIUM);
  parsed.searchParams.set('utm_campaign', campaign);

  return parsed.toString();
}
