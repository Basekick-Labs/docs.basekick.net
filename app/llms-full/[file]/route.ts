import { notFound } from 'next/navigation';
import { getLLMText, getProducts } from '@/lib/source';

export const revalidate = false;

// /llms-full/<product>.txt: every page of one product as a single Markdown
// file. /llms-full.txt holds all four products and is too large for most
// context windows; an agent working on arcli does not need the Arc Enterprise
// reference to come with it.

export async function GET(_req: Request, { params }: RouteContext<'/llms-full/[file]'>) {
  const { file } = await params;
  const product = getProducts().find((p) => `${p.slug}.txt` === file);
  if (!product) notFound();

  const pages = await Promise.all(product.pages.map(getLLMText));

  // The static export writes only the body; the type and charset come from
  // the /llms-full/ location in nginx.conf.
  return new Response(pages.join('\n\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export function generateStaticParams() {
  return getProducts().map((product) => ({ file: `${product.slug}.txt` }));
}
