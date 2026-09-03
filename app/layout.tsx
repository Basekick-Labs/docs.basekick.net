import { Inter } from 'next/font/google';
import type { Metadata } from 'next';
import { Provider } from '@/components/provider';
import { LaunchPulseAnalytics } from '@/components/launchpulse';
import { siteUrl } from '@/lib/shared';
import './global.css';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  // Required for static export to emit absolute OG/canonical URLs.
  metadataBase: new URL(siteUrl),
  title: {
    // Byte-identical to the titles the Docusaurus site already emits.
    // Changing every title at once is a ranking-volatility event, so this
    // suffix is deliberately preserved.
    template: '%s | Arc Documentation',
    default: 'Arc Documentation',
  },
  description:
    'Documentation for Arc, the open, SQL-native time-series database, plus Arc Enterprise and Arc Launchpad.',
  alternates: { canonical: '/' },
  // public/favicon.ico is not picked up automatically - Next only auto-detects
  // app/icon.*, so without this the site ships no favicon at all.
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/img/basekick-logo-icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
  openGraph: {
    siteName: 'Arc Documentation',
    type: 'website',
    locale: 'en',
    url: '/',
    images: '/img/og-docs.jpg',
  },
  twitter: {
    card: 'summary_large_image',
    images: '/img/og-docs.jpg',
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <Provider>{children}</Provider>
        <LaunchPulseAnalytics />
      </body>
    </html>
  );
}
