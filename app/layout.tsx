import { Inter } from 'next/font/google';
import type { Metadata } from 'next';
import { Provider } from '@/components/provider';
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
    'Documentation for Arc, the high-performance columnar analytical database, plus Arc Enterprise and Arc Launchpad.',
  alternates: { canonical: '/' },
  openGraph: {
    siteName: 'Arc Documentation',
    type: 'website',
    locale: 'en',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
