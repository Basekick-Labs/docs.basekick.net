import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { gitConfig } from './shared';
import { withUtm } from './utm';

/**
 * Shared nav for both layouts.
 *
 * The product links matter more than they look: each product tree is a
 * `root: true` folder, which scopes the sidebar to that product. From inside
 * /arc/ the sidebar shows no Enterprise or Launchpad links at all, so these
 * are the only navigation between the three.
 *
 * The logo is basekick.net's own mark plus its wordmark treatment - the
 * previous build squeezed a wide screenshot into a 20x20 box.
 */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/basekick-logo-icon.svg" alt="" width={22} height={22} />
          <span className="text-[0.95rem] tracking-tight">
            <span className="font-semibold">Basekick</span>
            <span className="ml-1.5 font-normal text-fd-muted-foreground">Labs</span>
          </span>
        </>
      ),
      transparentMode: 'top',
    },
    links: [
      { text: 'Arc OSS', url: '/arc/', active: 'nested-url' },
      { text: 'Arc Enterprise', url: '/arc-enterprise/', active: 'nested-url' },
      { text: 'Arc Launchpad', url: '/launchpad/', active: 'nested-url' },
      { text: 'Blog', url: withUtm('https://basekick.net/blog', 'nav'), external: true },
      { text: 'Website', url: withUtm('https://basekick.net', 'nav'), external: true },
    ],
    githubUrl: `https://github.com/${gitConfig.user}`,
  };
}
