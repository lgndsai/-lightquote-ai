import { requireRole } from '@/lib/auth';
import { CompanyForm } from './CompanyForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Company — Admin' };

export default async function AdminCompanyPage() {
  const session = await requireRole('admin');
  return <CompanyForm company={session.company} />;
}
