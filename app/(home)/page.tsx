import Link from 'next/link';
import { getLatestPosts } from '@/lib/blog';

const PRODUCTS = [
  {
    name: 'Arc',
    href: '/arc/',
    tagline: 'The open-source columnar analytical database.',
    description:
      'Install it, ingest over line protocol or MessagePack, query with SQL, and connect Grafana, Telegraf, MQTT or OpenTelemetry.',
  },
  {
    name: 'Arc Enterprise',
    href: '/arc-enterprise/',
    tagline: 'Arc for clusters, with the controls a shared deployment needs.',
    description:
      'Multi-node clustering, RBAC, audit logging, tiered storage and query governance, on top of everything in Arc.',
  },
  {
    name: 'Arc Launchpad',
    href: '/launchpad/',
    tagline: 'A self-hosted console for the Arc instances you run.',
    description:
      'Run SQL, browse logs, manage tokens and retention, set up alerts and continuous queries, and share access with a team.',
  },
];

export default async function HomePage() {
  const posts = await getLatestPosts(3);

  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto w-full max-w-5xl px-4 pt-16 pb-10 sm:pt-24">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Basekick Labs documentation
        </h1>
        <p className="mt-4 max-w-2xl text-fd-muted-foreground">
          Guides, reference and operational detail for Arc and the tools around it.
        </p>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 pb-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((product) => (
            <Link
              key={product.href}
              href={product.href}
              className="group flex flex-col rounded-xl border border-fd-border bg-fd-card p-5 transition-colors hover:border-fd-primary/40 hover:bg-fd-accent"
            >
              <h2 className="font-semibold group-hover:text-fd-primary">{product.name}</h2>
              <p className="mt-1 text-sm font-medium text-fd-foreground/80">{product.tagline}</p>
              <p className="mt-3 text-sm text-fd-muted-foreground">{product.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Omitted entirely when the feed is unreachable, rather than rendering
          an empty heading. */}
      {posts.length > 0 && (
        <section className="mx-auto w-full max-w-5xl px-4 pb-20">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold">From the blog</h2>
            <a
              href="https://basekick.net/blog"
              className="text-sm text-fd-muted-foreground underline underline-offset-4 hover:text-fd-foreground"
            >
              All posts
            </a>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {posts.map((post) => (
              <a
                key={post.url}
                href={post.url}
                className="group flex flex-col rounded-xl border border-fd-border p-5 transition-colors hover:border-fd-primary/40 hover:bg-fd-accent"
              >
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
                <h3 className="mt-2 font-medium leading-snug group-hover:text-fd-primary">
                  {post.title}
                </h3>
                {post.description && (
                  <p className="mt-2 line-clamp-3 text-sm text-fd-muted-foreground">
                    {post.description}
                  </p>
                )}
              </a>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
