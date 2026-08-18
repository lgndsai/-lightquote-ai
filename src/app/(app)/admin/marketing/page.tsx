import { requireRole } from '@/lib/auth';
import { loadMarketingConfig } from '@/lib/marketing';
import { MarketingForm } from './MarketingForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Marketing — Admin' };

export default async function AdminMarketingPage() {
  const session = await requireRole('admin');
  const config = await loadMarketingConfig(session.company.id);

  return <MarketingForm config={config} />;
}
