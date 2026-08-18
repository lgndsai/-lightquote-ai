import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CatalogManager } from './CatalogManager';
import type { CatalogItem } from '@/lib/types/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Catalog — Admin' };

export default async function AdminCatalogPage() {
  const session = await requireRole('admin');
  const supabase = await createClient();

  const { data } = await supabase
    .from('company_catalog_items')
    .select('*')
    .eq('company_id', session.company.id)
    .order('kind', { ascending: true })
    .order('sort_order', { ascending: true });

  return <CatalogManager items={(data ?? []) as CatalogItem[]} />;
}
