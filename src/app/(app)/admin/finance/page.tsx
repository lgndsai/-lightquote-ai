import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { FinanceManager } from './FinanceManager';
import type { FinanceProgram } from '@/lib/types/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Finance — Admin' };

export default async function AdminFinancePage() {
  const session = await requireRole('admin');
  const supabase = await createClient();

  const { data } = await supabase
    .from('finance_programs')
    .select('*')
    .eq('company_id', session.company.id)
    .order('sort_order', { ascending: true });

  return <FinanceManager programs={(data ?? []) as FinanceProgram[]} />;
}
