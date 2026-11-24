import { getLLMText, getProducts } from '@/lib/source';

export const revalidate = false;

// Every page of every product, in sidebar order. /llms-full/<product>.txt
// holds one product at a time and is the better fit for a context window.
export async function GET() {
  const pages = getProducts().flatMap((product) => product.pages);
  const scanned = await Promise.all(pages.map(getLLMText));

  // The static export writes only the body; the type and charset come from
  // the /llms-full.txt location in nginx.conf.
  return new Response(scanned.join('\n\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
