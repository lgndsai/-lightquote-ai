import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/AppHeader';
import { QuoteCard } from '@/components/QuoteCard';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/pricing/engine';
import type { QuoteListItem } from '@/lib/types/db';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'recent', label: 'Recent' },
  { key: 'pending', label: 'Pending' },
  { key: 'sold', label: 'Sold' },
  { key: 'installed', label: 'Installed' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const SELECT =
  '*, customers(first_name,last_name), properties(address_line1,city,state,zip), projects(status)';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireSession();
  const { tab } = await searchParams;
  const active: TabKey = (TABS.find((t) => t.key === tab)?.key ?? 'recent') as TabKey;

  const supabase = await createClient();

  // RLS already scopes these to the company (and to the rep for sales_rep).
  let query = supabase.from('quotes').select(SELECT).order('created_at', { ascending: false }).limit(30);

  if (active === 'pending') {
    query = supabase
      .from('quotes')
      .select(SELECT)
      .in('status', ['draft', 'pending'])
      .order('created_at', { ascending: false })
      .limit(30);
  } else if (active === 'sold') {
    query = supabase
      .from('quotes')
      .select(SELECT)
      .eq('status', 'sold')
      .order('sold_at', { ascending: false })
      .limit(30);
  } else if (active === 'installed') {
    query = supabase
      .from('quotes')
      .select('*, customers(first_name,last_name), properties(address_line1,city,state,zip), projects!inner(status)')
      .eq('projects.status', 'installed')
      .order('created_at', { ascending: false })
      .limit(30);
  }

  const [{ data: quotesData, error }, soldStats] = await Promise.all([
    query,
    supabase.from('quotes').select('total, status').eq('status', 'sold'),
  ]);

  const quotes = (quotesData ?? []) as unknown as QuoteListItem[];
  const soldCount = soldStats.data?.length ?? 0;
  const soldValue = (soldStats.data ?? []).reduce(
    (sum, q) => sum + Number((q as { total: number }).total ?? 0),
    0,
  );

  return (
    <>
      <AppHeader session={session} />

      <main className="mx-auto max-w-3xl px-4 pb-40">
        <section className="pt-5">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-ink">
            {greeting()}, {session.user.full_name?.split(' ')[0] ?? 'there'}
          </h1>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label="Sold this period" value={String(soldCount)} />
            <Stat label="Contract value" value={formatCurrency(soldValue)} />
          </div>
          <Link
            href="/projects"
            className="mt-3 flex min-h-13 items-center justify-between rounded-2xl border border-line bg-card px-4 font-semibold text-ink shadow-sm"
          >
            Installs &amp; projects
            <span aria-hidden className="text-muted">›</span>
          </Link>
        </section>

        <nav className="sticky top-[68px] z-20 -mx-4 mt-6 bg-paper/90 px-4 py-2 backdrop-blur-xl">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={t.key === 'recent' ? '/dashboard' : `/dashboard?tab=${t.key}`}
                scroll={false}
                className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                  active === t.key
                    ? 'bg-ink text-white'
                    : 'border border-line bg-card text-muted'
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </nav>

        <section className="mt-3 space-y-3">
          {error ? (
            <EmptyState
              title="Could not load quotes"
              body="Check your Supabase connection and try again."
            />
          ) : quotes.length === 0 ? (
            <EmptyState
              title="No quotes here yet"
              body="Start a new quote and you will be at a price in under five minutes."
              action={
                <ButtonLink href="/quotes/new" variant="primary" size="lg">
                  Start a quote
                </ButtonLink>
              }
            />
          ) : (
            quotes.map((quote) => <QuoteCard key={quote.id} quote={quote} />)
          )}
        </section>
      </main>

      {/* Primary CTA sits in the thumb zone, above the home indicator. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-paper via-paper/95 to-transparent px-4 pt-8 pb-safe">
        <div className="pointer-events-auto mx-auto max-w-3xl">
          <ButtonLink href="/quotes/new" variant="primary" size="xl" fullWidth>
            + NEW QUOTE
          </ButtonLink>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-4 py-3 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</p>
    </div>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
