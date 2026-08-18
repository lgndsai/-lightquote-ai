import { requireRole } from '@/lib/auth';
import { loadPricingConfig } from '@/lib/pricing/load';
import { PricingForm } from './PricingForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pricing — Admin' };

export default async function AdminPricingPage() {
  const session = await requireRole('admin');
  const config = await loadPricingConfig(session.company.id);

  return <PricingForm pricing={config.pricing} />;
}
