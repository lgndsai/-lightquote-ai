import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { UsersManager } from './UsersManager';
import type { AppUser } from '@/lib/types/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Users — Admin' };

export default async function AdminUsersPage() {
  const session = await requireRole('admin');
  const supabase = await createClient();

  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('company_id', session.company.id)
    .order('created_at', { ascending: true });

  return <UsersManager users={(data ?? []) as AppUser[]} currentUserId={session.user.id} />;
}
