import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { AppUser, Company, UserRole } from '@/lib/types/db';

export interface Session {
  user: AppUser;
  company: Company;
}

/**
 * Loads the signed-in rep's profile and company. Every page in the (app)
 * group calls this, which is what pins the request to a single tenant.
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*, companies(*)')
    .eq('id', authUser.id)
    .maybeSingle();

  if (error || !data) return null;

  const { companies, ...appUser } = data as AppUser & { companies: Company | null };
  if (!companies) return null;

  return { user: appUser as AppUser, company: companies };
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

export async function requireRole(...roles: UserRole[]): Promise<Session> {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) redirect('/dashboard');
  return session;
}

export function canManageCompany(role: UserRole) {
  return role === 'admin';
}

export function canViewAllQuotes(role: UserRole) {
  return role === 'admin' || role === 'manager';
}
