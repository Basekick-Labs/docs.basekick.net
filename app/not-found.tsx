import Link from 'next/link';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { withUtm } from '@/lib/utm';

const DESTINATIONS = [
  { name: 'Arc', href: '/arc/', description: 'Install, configure, ingest and query.' },
  {
    name: 'Arc Enterprise',
    href: '/arc-enterprise/',
    description: 'Clustering, RBAC, tiered storage and governance.',
  },
  {
    name: 'Arc Launchpad',
    href: '/launchpad/',
    description: 'The self-hosted console for your Arc instances.',
  },
];

export default function NotFound() {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-20">
        <p className="text-sm font-medium text-fd-muted-foreground">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">This page does not exist</h1>
        <p className="mt-4 text-fd-muted-foreground">
          It may have moved, or the link that brought you here may be out of date. Memtrace and
          Liftbridge documentation has been retired.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {DESTINATIONS.map((destination) => (
            <Link
              key={destination.href}
              href={destination.href}
              className="group rounded-xl border border-fd-border p-4 transition-colors hover:border-fd-primary/40 hover:bg-fd-accent"
            >
              <span className="font-medium group-hover:text-fd-primary">{destination.name}</span>
              <span className="mt-1 block text-sm text-fd-muted-foreground">
                {destination.description}
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-sm text-fd-muted-foreground">
          You can also{' '}
          <a
            href={withUtm('https://basekick.net', '404')}
            className="underline underline-offset-4 hover:text-fd-foreground"
          >
            visit basekick.net
          </a>
          .
        </p>
      </main>
    </HomeLayout>
  );
}
