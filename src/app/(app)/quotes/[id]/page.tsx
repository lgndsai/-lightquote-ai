import { redirect } from 'next/navigation';
import { getQuoteContext, nextStepFor } from '@/lib/quotes';

export const dynamic = 'force-dynamic';

/** Entry point for a quote — forwards to whichever step is next. */
export default async function QuoteIndexPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getQuoteContext(id);
  redirect(nextStepFor(ctx));
}
