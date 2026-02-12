import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Arc Documentation',
  tagline: 'High-performance time-series database',
  favicon: 'img/favicon.ico',

  // Multi-instance docs: Liftbridge
  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'liftbridge',
        path: 'docs-liftbridge',
        routeBasePath: 'liftbridge',
        sidebarPath: './sidebarsLiftbridge.ts',
        editUrl: 'https://github.com/Basekick-Labs/docs.basekick.net/tree/main/',
      },
    ],
  ],

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://docs.basekick.net',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'Basekick-Labs', // Usually your GitHub org/user name.
  projectName: 'docs.basekick.net', // Usually your repo name.

  trailingSlash: false,
  onBrokenLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: 'arc',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/Basekick-Labs/docs.basekick.net/tree/main/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // OpenGraph social card
    image: 'img/arc.png',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Basekick Labs Docs',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Arc',
        },
        {
          type: 'docSidebar',
          sidebarId: 'liftbridgeSidebar',
          docsPluginId: 'liftbridge',
          position: 'left',
          label: 'Liftbridge',
        },
        {
          href: 'https://basekick.net',
          label: 'Website',
          position: 'right',
        },
        {
          href: 'https://github.com/Basekick-Labs',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Products',
          items: [
            {
              label: 'Arc',
              to: '/arc',
            },
            {
              label: 'Liftbridge',
              to: '/liftbridge',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub Discussions',
              href: 'https://github.com/Basekick-Labs/arc/discussions',
            },
            {
              label: 'Discord',
              href: 'https://discord.gg/nxnWfUxsdm',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Website',
              href: 'https://basekick.net',
            },
            {
              label: 'Blog',
              href: 'https://basekick.net/blog',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/Basekick-Labs',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Basekick Labs. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
