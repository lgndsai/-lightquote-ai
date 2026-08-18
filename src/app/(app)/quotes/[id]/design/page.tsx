import { redirect } from 'next/navigation';
import { getQuoteContext } from '@/lib/quotes';
import { DesignStudio } from './DesignStudio';
import type { RooflineStroke } from '@/lib/types/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Lighting design — LumaGlow' };

export default async function DesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getQuoteContext(id);

  // Can't trace without a photo.
  if (!ctx.baseDesign?.original_image_url) redirect(`/quotes/${id}/photo`);

  return (
    <DesignStudio
      quoteId={ctx.quote.id}
      companyId={ctx.quote.company_id}
      designId={ctx.baseDesign.id}
      imageUrl={ctx.baseDesign.original_image_url}
      initialStrokes={(ctx.baseDesign.roofline_coordinates ?? []) as RooflineStroke[]}
      initialStyle={ctx.baseDesign.lighting_style}
    />
  );
}
