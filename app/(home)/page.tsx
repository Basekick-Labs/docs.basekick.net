import Link from 'next/link';
import { getLatestPosts } from '@/lib/blog';
import { withUtm } from '@/lib/utm';
import { ArcMark, EnterpriseMark } from '@/components/ProductMarks';

const PRODUCTS = [
  {
    name: 'Arc OSS',
    href: '/arc/',
    tagline: 'The open, SQL-native time-series database.',
    description:
      'Install it, ingest over Line Protocol or MessagePack, query with SQL, and connect Grafana, Telegraf, MQTT or OpenTelemetry.',
    visual: <ArcMark />,
  },
  {
    name: 'Arc Enterprise',
    href: '/arc-enterprise/',
    tagline: 'Arc for clusters, with the controls a shared deployment needs.',
    description:
      'Multi-node clustering, RBAC, audit logging, tiered storage and query governance, on top of everything in Arc.',
    visual: <EnterpriseMark />,
  },
  {
    name: 'Arc Launchpad',
    href: '/launchpad/',
    tagline: 'A self-hosted console for the Arc instances you run.',
    description:
      'Run SQL, browse logs, manage tokens and retention, set up alerts and continuous queries, and share access with a team.',
    visual: (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/img/launchpad/launchpad-sql-console.png"
        alt="The Launchpad SQL console"
        loading="lazy"
        width={1600}
        height={900}
        className="h-full w-full object-cover object-left-top"
      />
    ),
  },
];

// The homepage is the site's highest-authority URL and carried no structured
// data at all; the docs pages get theirs from StructuredData.tsx.
const SITE_JSONLD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://docs.basekick.net/#website',
      name: 'Arc Documentation',
      url: 'https://docs.basekick.net/',
      description:
        'Documentation for Arc, the open, SQL-native time-series database, plus Arc Enterprise and Arc Launchpad.',
      inLanguage: 'en',
      publisher: { '@id': 'https://basekick.net/#organization' },
    },
    {
      '@type': 'Organization',
      '@id': 'https://basekick.net/#organization',
      name: 'Basekick Labs',
      url: 'https://basekick.net',
      logo: 'https://docs.basekick.net/img/basekick-logo-icon.svg',
      sameAs: ['https://github.com/Basekick-Labs'],
    },
  ],
};

export default async function HomePage() {
  const posts = await getLatestPosts(3);

  return (
    <main className="flex flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSONLD) }}
      />
      {/* Hero. Grid texture and the two brand glows are lifted from
          basekick.net so the docs read as the same product. */}
      <section className="relative overflow-hidden border-b border-fd-border">
        <div className="arc-grid-bg pointer-events-none absolute inset-0" aria-hidden />
        <div
          className="pointer-events-none absolute top-0 right-0 hidden -translate-y-1/3 translate-x-1/4 md:block"
          aria-hidden
        >
          <div className="h-[560px] w-[560px] rounded-full bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-transparent blur-3xl" />
        </div>
        <div
          className="pointer-events-none absolute bottom-0 left-0 hidden translate-y-1/2 -translate-x-1/3 md:block"
          aria-hidden
        >
          <div className="h-[460px] w-[460px] rounded-full bg-gradient-to-tr from-fuchsia-500/10 via-purple-500/5 to-transparent blur-3xl" />
        </div>

        <div className="relative mx-auto w-full max-w-(--fd-layout-width) px-4 py-20 md:py-28">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-card/60 px-3 py-1 text-xs font-medium text-fd-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-fd-primary" aria-hidden />
            Documentation
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-balance md:text-5xl md:leading-[1.1]">
            Everything you need to run{' '}
            <span className="bg-gradient-to-r from-cyan-300 via-sky-400 to-fuchsia-400 bg-clip-text text-transparent">
              Arc in production.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-fd-muted-foreground">
            Install guides, configuration reference, integrations and operational detail for Arc,
            Arc Enterprise and Arc Launchpad.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/arc/getting-started/"
              className="rounded-lg bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
            >
              Get started with Arc
            </Link>
            <Link
              href="/arc/installation/docker/"
              className="rounded-lg border border-fd-border bg-fd-card px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
            >
              Run it with Docker
            </Link>
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="mx-auto w-full max-w-(--fd-layout-width) px-4 py-16">
        <div className="grid gap-5 lg:grid-cols-3">
          {PRODUCTS.map((product) => (
            <Link
              key={product.href}
              href={product.href}
              className="group flex flex-col overflow-hidden rounded-xl border border-fd-border bg-fd-card transition-colors hover:border-fd-primary/50"
            >
              <div className="relative h-36 overflow-hidden border-b border-fd-border bg-fd-secondary/40">
                {product.visual}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h2 className="font-semibold transition-colors group-hover:text-fd-primary">
                  {product.name}
                </h2>
                <p className="mt-1 text-sm font-medium text-fd-foreground/80">{product.tagline}</p>
                <p className="mt-3 text-sm text-fd-muted-foreground">{product.description}</p>
                <span className="mt-4 text-sm font-medium text-fd-primary">
                  Read the docs{' '}
                  <span className="inline-block transition-transform group-hover:translate-x-0.5">
                    &rarr;
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Omitted entirely when the feed is unreachable, rather than rendering
          an empty heading. */}
      {posts.length > 0 && (
        <section className="mx-auto w-full max-w-(--fd-layout-width) px-4 pb-20">
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold">From the blog</h2>
            <a
              href={withUtm('https://basekick.net/blog', 'homepage')}
              className="text-sm text-fd-muted-foreground underline underline-offset-4 transition-colors hover:text-fd-foreground"
            >
              All posts
            </a>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {posts.map((post) => (
              <a
                key={post.url}
                href={withUtm(post.url, 'homepage-blog')}
                className="group flex flex-col overflow-hidden rounded-xl border border-fd-border bg-fd-card transition-colors hover:border-fd-primary/50"
              >
                {post.image && (
                  <div className="aspect-[1200/630] overflow-hidden border-b border-fd-border bg-fd-secondary/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.image}
                      alt=""
                      loading="lazy"
                      width={1200}
                      height={630}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-5">
                  {post.date && (
                    <time dateTime={post.date} className="text-xs text-fd-muted-foreground">
                      {new Date(post.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC',
                      })}
                    </time>
                  )}
                  <h3 className="mt-2 leading-snug font-medium transition-colors group-hover:text-fd-primary">
                    {post.title}
                  </h3>
                  {post.description && (
                    <p className="mt-2 line-clamp-3 text-sm text-fd-muted-foreground">
                      {post.description}
                    </p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
