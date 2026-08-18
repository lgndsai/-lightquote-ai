'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Company, CompanyMarketingConfig, Customer, Property, Proposal, Quote } from '@/lib/types/db';
import type { PricingResult } from '@/lib/pricing/engine';
import type { LongTermComparison } from '@/lib/marketing';
import { formatCurrency } from '@/lib/pricing/engine';
import { acceptProposal, getProposalDocumentUrl } from '../actions';
import { Button } from '@/components/ui/Button';
import { ProgressSteps } from '@/components/ProgressSteps';
import { ValueCards } from '@/components/ValueCards';
import { BenefitsGrid } from '@/components/BenefitsGrid';
import { addressLine, customerName, formatDate } from '@/lib/format';

interface Props {
  quote: Quote;
  company: Company;
  customer: Customer;
  property: Property;
  pricing: PricingResult;
  adderLabels: string[];
  financeProgramName: string | null;
  salesRepName: string;
  proposal: Proposal | null;
  heroUrl: string | null;
  projectId: string | null;
  marketing: CompanyMarketingConfig;
  comparison: LongTermComparison;
}

export function ProposalScreen({
  quote,
  company,
  customer,
  property,
  pricing,
  adderLabels,
  financeProgramName,
  salesRepName,
  proposal,
  heroUrl,
  projectId,
  marketing,
  comparison,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAccept, setShowAccept] = useState(false);
  const [acceptName, setAcceptName] = useState(`${customer.first_name} ${customer.last_name}`);
  const [error, setError] = useState<string | null>(null);
  const [openingDoc, setOpeningDoc] = useState(false);

  const sold = quote.status === 'sold';

  const accept = useCallback(() => {
    startTransition(async () => {
      const result = await acceptProposal({ quote_id: quote.id, accepted_by_name: acceptName });
      if (result.error) {
        setError(result.error);
        return;
      }
      setShowAccept(false);
      router.refresh();
    });
  }, [acceptName, quote.id, router]);

  const openDocument = useCallback(async () => {
    setOpeningDoc(true);
    const url = await getProposalDocumentUrl(quote.id);
    setOpeningDoc(false);
    if (url) window.open(url, '_blank', 'noopener');
    else setError('The stored proposal document is not available yet.');
  }, [quote.id]);

  if (sold) {
    return (
      <SoldConfirmation
        customerName={customerName(customer)}
        acceptedBy={proposal?.accepted_by_name ?? null}
        soldAt={quote.sold_at}
        total={pricing.total}
        financing={quote.financing_selected}
        monthlyPayment={pricing.monthlyPayment}
        projectId={projectId}
        onOpenDocument={openDocument}
        openingDoc={openingDoc}
      />
    );
  }

  return (
    <div className="bg-luma-surface min-h-dvh pb-44">
      <header className="px-4 pt-safe no-print">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between py-2">
            <Link
              href={`/quotes/${quote.id}/present`}
              className="-ml-2 flex h-11 items-center px-2 text-[15px] font-semibold text-white/60"
            >
              ‹ Back
            </Link>
            <span className="w-14" />
          </div>
          <ProgressSteps current="proposal" tone="dark" />
        </div>
      </header>

      <main className="mx-auto mt-5 max-w-3xl space-y-8 px-4">
        {heroUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={heroUrl} alt="Your custom LumaGlow design" className="w-full rounded-3xl object-cover shadow-2xl" />
        ) : null}

        <div className="text-center">
          {company.logo_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={company.logo_url} alt={company.name} className="mx-auto mb-3 h-9 max-w-40 object-contain" />
          ) : null}
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-accent-soft">
            Proposal {proposal?.proposal_number ?? quote.quote_number}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-white">{customerName(customer)}</p>
          <p className="text-[13px] text-white/55">{addressLine(property)}</p>
        </div>

        <section className="grid grid-cols-3 gap-3">
          <SystemStat label="Linear Feet" value={String(Number(quote.linear_feet))} />
          <SystemStat label="Track" value={quote.track_color ?? '—'} />
          <SystemStat label="Features" value={adderLabels.length > 0 ? `${adderLabels.length} added` : 'Standard'} />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/4 p-6 text-center">
          {pricing.retailComparison.enabled ? (
            <div className="mx-auto mb-5 grid max-w-sm grid-cols-3 gap-3 border-b border-white/10 pb-5">
              <InvestmentStat label={pricing.retailComparison.retailLabel} value={formatCurrency(pricing.retailComparison.retailValue)} strike />
              <InvestmentStat label={pricing.retailComparison.sellingPriceLabel} value={formatCurrency(pricing.retailComparison.standardValue)} />
              <InvestmentStat label={pricing.retailComparison.savingsLabel} value={formatCurrency(Math.max(0, pricing.retailComparison.savings))} tone="ok" />
            </div>
          ) : null}
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/40">
            {quote.financing_selected ? 'Estimated monthly payment' : 'Total cash price'}
          </p>
          <p className="text-luma-gradient mt-1 text-5xl font-bold tracking-tight">
            {quote.financing_selected
              ? `${formatCurrency(pricing.monthlyPayment, { maximumFractionDigits: 0 })}/mo`
              : formatCurrency(pricing.total)}
          </p>
          {quote.financing_selected && financeProgramName ? (
            <p className="mt-1 text-[13px] text-white/45">{financeProgramName}</p>
          ) : null}
        </section>

        <ValueCards config={marketing} comparison={comparison} />
        <BenefitsGrid benefits={marketing.benefits} tone="dark" />

        <div className="no-print">
          <Button variant="dark" size="lg" fullWidth onClick={openDocument} disabled={openingDoc}>
            {openingDoc ? 'Opening…' : 'View stored proposal document'}
          </Button>
        </div>

        {error ? (
          <p role="alert" className="rounded-2xl bg-danger/20 px-4 py-3 text-sm font-medium text-red-200">
            {error}
          </p>
        ) : null}

        <p className="text-center text-[12px] text-white/35">
          Prepared by {salesRepName} · {company.name}
        </p>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-ink via-ink/95 to-transparent px-4 pt-8 pb-safe no-print">
        <div className="mx-auto max-w-3xl space-y-2.5">
          {showAccept ? (
            <div className="rounded-3xl border border-white/12 bg-white/8 p-4 backdrop-blur">
              <label className="block">
                <span className="mb-2 block text-[12px] font-bold uppercase tracking-[0.12em] text-white/55">
                  Type your name to accept
                </span>
                <input
                  value={acceptName}
                  onChange={(event) => setAcceptName(event.target.value)}
                  autoCapitalize="words"
                  className="min-h-14 w-full rounded-2xl border border-white/15 bg-white/10 px-4 text-white placeholder:text-white/40 focus:border-accent focus:outline-none"
                />
              </label>
              <div className="mt-3 flex gap-2">
                <Button variant="dark" size="lg" onClick={() => setShowAccept(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  variant="accent"
                  size="lg"
                  onClick={accept}
                  disabled={pending || acceptName.trim().length < 2}
                  className="flex-[2]"
                >
                  {pending ? 'Saving…' : 'CONFIRM'}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="accent" size="xl" fullWidth onClick={() => setShowAccept(true)}>
              {quote.financing_selected ? 'CONTINUE WITH FINANCING' : 'ACCEPT DESIGN & CONTINUE'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SoldConfirmation({
  customerName,
  acceptedBy,
  soldAt,
  total,
  financing,
  monthlyPayment,
  projectId,
  onOpenDocument,
  openingDoc,
}: {
  customerName: string;
  acceptedBy: string | null;
  soldAt: string | null;
  total: number;
  financing: boolean;
  monthlyPayment: number;
  projectId: string | null;
  onOpenDocument: () => void;
  openingDoc: boolean;
}) {
  return (
    <div className="bg-luma-surface flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="rise glow-accent flex h-24 w-24 items-center justify-center rounded-full bg-luma-gradient">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <h1 className="rise mt-6 text-3xl font-bold tracking-tight text-white">You&rsquo;re all set</h1>
      <p className="rise mt-2 max-w-xs text-[15px] text-white/60">
        {acceptedBy ?? customerName} accepted the design{soldAt ? ` on ${formatDate(soldAt)}` : ''}.
      </p>

      <div className="rise mt-6 rounded-3xl border border-white/10 bg-white/4 px-8 py-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">
          {financing ? 'Monthly payment' : 'Contract value'}
        </p>
        <p className="text-luma-gradient mt-1 text-4xl font-bold tracking-tight">
          {financing ? `${formatCurrency(monthlyPayment, { maximumFractionDigits: 0 })}/mo` : formatCurrency(total)}
        </p>
      </div>

      <div className="mt-8 w-full max-w-xs space-y-2.5">
        {projectId ? (
          <Link
            href={`/projects/${projectId}`}
            className="flex min-h-14 items-center justify-center rounded-2xl bg-luma-gradient font-semibold text-white shadow-lg"
          >
            Open the project
          </Link>
        ) : null}
        <Button variant="dark" size="lg" fullWidth onClick={onOpenDocument} disabled={openingDoc}>
          {openingDoc ? 'Opening…' : 'View proposal document'}
        </Button>
        <Link
          href="/dashboard"
          className="flex min-h-14 items-center justify-center rounded-2xl border border-white/15 font-semibold text-white/70"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function SystemStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 px-3 py-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">{label}</p>
      <p className="mt-1 truncate text-[15px] font-semibold text-white">{value}</p>
    </div>
  );
}

function InvestmentStat({
  label,
  value,
  strike,
  tone,
}: {
  label: string;
  value: string;
  strike?: boolean;
  tone?: 'ok';
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold ${
          strike ? 'text-white/40 line-through decoration-2' : tone === 'ok' ? 'text-ok' : 'text-white'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
