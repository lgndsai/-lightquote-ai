import { getQuoteContext } from '@/lib/quotes';
import { PhotoCapture } from './PhotoCapture';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Property photo — LightQuote AI' };

export default async function PhotoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getQuoteContext(id);

  return (
    <PhotoCapture
      quoteId={ctx.quote.id}
      companyId={ctx.quote.company_id}
      propertyId={ctx.property.id}
      designId={ctx.baseDesign?.id ?? null}
      existingUrl={ctx.baseDesign?.original_image_url ?? null}
      addressLine={ctx.property.address_line1}
    />
  );
}
