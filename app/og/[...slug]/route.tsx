import { getPageImageUrl, source } from '@/lib/source';
import { notFound } from 'next/navigation';
import { ImageResponse } from 'next/og';
import { productOf } from '@/lib/metadata';

export const revalidate = false;

/**
 * Social cards, in basekick.net's house style.
 *
 * Values are taken from that site's own OG generator (scripts/og/*.html): the
 * #0a1120 ground, the cyan->fuchsia top rule, the 32px graph-paper grid, the
 * corner glows, the wordmark tracking, the pill, and the 88x4 accent rule.
 * The blog renders its cards in headless Chromium; this runs through Satori at
 * build time for all 132 pages, so anything Satori cannot do (backdrop blur,
 * background-clip:text, real blur filters) is approximated with layered
 * gradients instead of dropped.
 */

const BG = '#0a1120';
const CYAN = '#22d3ee';
const SLATE = '#8b9bb4';

// Satori has no background-clip:text, so the headline's accent is carried by a
// solid brand colour on the trailing line rather than a gradient fill.
const ACCENT_BY_PRODUCT: Record<string, string> = {
  arc: '#67e8f9',
  'arc-enterprise': '#818cf8',
  launchpad: '#e879f9',
};

const PRODUCT_LABEL: Record<string, string> = {
  arc: 'ARC OSS',
  'arc-enterprise': 'ARC ENTERPRISE',
  launchpad: 'ARC LAUNCHPAD',
};

export async function GET(_req: Request, { params }: RouteContext<'/og/[...slug]'>) {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();

  const product = productOf(slug.slice(0, -1));
  const key = product?.key ?? 'arc';
  const accent = ACCENT_BY_PRODUCT[key] ?? CYAN;
  const label = PRODUCT_LABEL[key] ?? 'DOCUMENTATION';

  // The section path, so a card shows where in the docs the page lives.
  const segments = slug.slice(0, -1);
  const breadcrumb = segments.length > 1 ? `/${segments.join('/')}/` : `/${segments[0] ?? ''}/`;

  const title = page.data.title ?? '';
  const description = page.data.description ?? '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          backgroundColor: BG,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Graph paper, same 32px cell as the site's .arc-grid-bg. Satori has
            no repeating background-image, so the grid is drawn as two sets of
            hairlines. */}
        {Array.from({ length: 21 }).map((_, i) => (
          <div
            key={`h${i}`}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: i * 32,
              height: 1,
              backgroundColor: 'rgba(148,163,184,0.06)',
            }}
          />
        ))}
        {Array.from({ length: 38 }).map((_, i) => (
          <div
            key={`v${i}`}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: i * 32,
              width: 1,
              backgroundColor: 'rgba(148,163,184,0.06)',
            }}
          />
        ))}

        {/* Corner glows, standing in for the blurred radials. */}
        <div
          style={{
            position: 'absolute',
            top: -260,
            right: -120,
            width: 720,
            height: 720,
            borderRadius: 720,
            background:
              'radial-gradient(circle, rgba(34,211,238,0.13) 0%, rgba(59,130,246,0.06) 45%, rgba(10,17,32,0) 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -320,
            right: -200,
            width: 760,
            height: 760,
            borderRadius: 760,
            background:
              'radial-gradient(circle, rgba(217,70,239,0.16) 0%, rgba(168,85,247,0.07) 45%, rgba(10,17,32,0) 70%)',
          }}
        />
        {/* Left shade, so the copy always sits on a darker ground. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(105deg, rgba(2,6,23,0.88) 0%, rgba(2,6,23,0.3) 55%, rgba(2,6,23,0) 100%)',
          }}
        />

        {/* Top rule */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background:
              'linear-gradient(90deg, #22d3ee 0%, #38bdf8 35%, #818cf8 65%, #e879f9 100%)',
          }}
        />

        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            padding: '56px 72px 48px',
          }}
        >
          <div
            style={{
              fontSize: 19,
              fontWeight: 700,
              color: '#f1f5f9',
              letterSpacing: '0.34em',
              marginBottom: 30,
            }}
          >
            BASEKICK LABS
          </div>

          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              alignItems: 'center',
              padding: '9px 18px',
              borderRadius: 10,
              border: `1px solid ${accent}61`,
              backgroundColor: 'rgba(8,47,73,0.35)',
              marginBottom: 30,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: accent, letterSpacing: '0.18em' }}>
              {label}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: title.length > 42 ? 52 : 62,
              lineHeight: 1.13,
              fontWeight: 800,
              letterSpacing: '-0.022em',
              color: '#f8fafc',
              marginBottom: 20,
              maxWidth: 940,
            }}
          >
            {title}
          </div>

          {description ? (
            <div
              style={{
                display: 'flex',
                fontSize: 24,
                lineHeight: 1.45,
                color: SLATE,
                maxWidth: 900,
                marginBottom: 24,
              }}
            >
              {description.length > 150 ? `${description.slice(0, 147)}…` : description}
            </div>
          ) : null}

          <div
            style={{
              width: 88,
              height: 4,
              borderRadius: 2,
              background: 'linear-gradient(90deg, #22d3ee 0%, #a855f7 100%)',
            }}
          />

          <div style={{ display: 'flex', flex: 1 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 9, height: 9, borderRadius: 9, backgroundColor: accent }} />
              <div style={{ fontSize: 19, color: '#e2e8f0' }}>docs.basekick.net</div>
            </div>
            <div style={{ display: 'flex', flex: 1 }} />
            <div
              style={{
                display: 'flex',
                fontSize: 17,
                color: '#64748b',
                fontFamily: 'monospace',
              }}
            >
              {breadcrumb}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    lang: page.locale,
    slug: getPageImageUrl(page).segments,
  }));
}
