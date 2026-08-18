import { redirect } from 'next/navigation';
import { getQuoteContext } from '@/lib/quotes';
import { VisualizationResult } from './VisualizationResult';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Visualization — LumaGlow' };

export default async function VisualizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getQuoteContext(id);

  if (!ctx.baseDesign?.original_image_url) redirect(`/quotes/${id}/photo`);

  const rendered = ctx.designs.filter((d) => d.status === 'complete' && d.rendered_image_url);
  if (rendered.length === 0) redirect(`/quotes/${id}/generating`);

  return (
    <VisualizationResult
      quoteId={id}
      baseDesignId={ctx.baseDesign.id}
      originalUrl={ctx.baseDesign.original_image_url}
      selectedDesignId={ctx.selectedDesign?.id ?? rendered[rendered.length - 1].id}
      designs={ctx.designs.map((d) => ({
        id: d.id,
        preset: d.preset,
        lighting_style: d.lighting_style,
        status: d.status,
        rendered_image_path: d.rendered_image_path,
        rendered_image_url: d.rendered_image_url,
      }))}
    />
  );
}
