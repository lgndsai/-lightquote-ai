import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/pricing/engine';
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_STYLE,
  addressLine,
  customerName,
  formatShortDate,
} from '@/lib/format';
import type { Customer, Project, ProjectStatus, Property } from '@/lib/types/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Projects — LightQuote AI' };

const TABS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'sold', label: 'Sold' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'installed', label: 'Installed' },
  { key: 'cancelled', label: 'Cancelled' },
];

type Row = Project & { customers: Customer | null; properties: Property | null };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireSession();
  const { status } = await searchParams;
  const active = TABS.find((t) => t.key === status)?.key ?? 'all';

  const supabase = await createClient();
  let query = supabase
    .from('projects')
    .select('*, customers(*), properties(*)')
    .order('sold_at', { ascending: false })
    .limit(50);

  if (active !== 'all') query = query.eq('status', active);

  const { data } = await query;
  const projects = (data ?? []) as unknown as Row[];

  return (
    <>
      <AppHeader session={session} />
      <main className="mx-auto max-w-3xl px-4 pt-5 pb-16">
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">Projects</h1>

        <nav className="-mx-4 mt-4 px-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TABS.map((tab) => (
              <Link
                key={tab.key}
                href={tab.key === 'all' ? '/projects' : `/projects?status=${tab.key}`}
                scroll={false}
                className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold ${
                  active === tab.key ? 'bg-ink text-white' : 'border border-line bg-card text-muted'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="mt-4 space-y-3">
          {projects.length === 0 ? (
            <EmptyState title="No projects yet" body="Accepted proposals show up here as projects." />
          ) : (
            projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block rounded-3xl border border-line bg-card p-4 shadow-sm active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[17px] font-semibold text-ink">
                      {customerName(project.customers)}
                    </p>
                    <p className="mt-1 truncate text-[13px] text-muted">
                      {addressLine(project.properties)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                      PROJECT_STATUS_STYLE[project.status as ProjectStatus]
                    }`}
                  >
                    {PROJECT_STATUS_LABEL[project.status as ProjectStatus]}
                  </span>
                </div>
                <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
                  <span className="text-2xl font-semibold tracking-tight text-ink">
                    {formatCurrency(Number(project.contract_value))}
                  </span>
                  <span className="text-[12px] text-muted">Sold {formatShortDate(project.sold_at)}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </main>
    </>
  );
}
