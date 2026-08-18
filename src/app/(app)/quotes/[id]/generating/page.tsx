import { redirect } from 'next/navigation';
import { getQuoteContext } from '@/lib/quotes';
import { GeneratingScreen } from './GeneratingScreen';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Generating — LightQuote AI' };

export default async function GeneratingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getQuoteContext(id);

  if (!ctx.baseDesign) redirect(`/quotes/${id}/photo`);

  const running = ctx.designs.filter((d) => d.status === 'pending' || d.status === 'processing');
  const done = ctx.designs.some((d) => d.status === 'complete' && d.rendered_image_url);

  // Nothing in flight and something already rendered — skip straight ahead.
  if (running.length === 0 && done) redirect(`/quotes/${id}/visualization`);

  return (
    <GeneratingScreen
      quoteId={id}
      previewUrl={ctx.baseDesign.marked_image_url ?? ctx.baseDesign.original_image_url}
      initialStatus={running[0]?.status ?? ctx.baseDesign.status}
      initialError={ctx.baseDesign.error_message}
      designId={ctx.baseDesign.id}
    />
  );
}
