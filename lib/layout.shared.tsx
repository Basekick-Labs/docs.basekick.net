import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';
import { gitConfig } from './shared';

/**
 * Shared nav and footer for both layouts.
 *
 * The product links matter more than they look: each product tree is a
 * `root: true` folder, which scopes the sidebar to that product. From inside
 * /arc/ the sidebar shows no Enterprise or Launchpad links at all, so these
 * are the only navigation between the three.
 */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <Image
            src="/img/arc-light.png"
            alt=""
            width={20}
            height={20}
            className="dark:hidden"
            unoptimized
          />
          <Image
            src="/img/arc-dark.jpeg"
            alt=""
            width={20}
            height={20}
            className="hidden dark:block rounded-sm"
            unoptimized
          />
          <span className="font-medium">Basekick Labs Docs</span>
        </>
      ),
      transparentMode: 'none',
    },
    links: [
      { text: 'Arc', url: '/arc/', active: 'nested-url' },
      { text: 'Arc Enterprise', url: '/arc-enterprise/', active: 'nested-url' },
      { text: 'Launchpad', url: '/launchpad/', active: 'nested-url' },
      {
        text: 'Blog',
        url: 'https://basekick.net/blog',
        external: true,
      },
      {
        text: 'Website',
        url: 'https://basekick.net',
        external: true,
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}`,
  };
}
