'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Company, Customer, Property, Proposal, Quote } from '@/lib/types/db';
import type { PricingResult } from '@/lib/pricing/engine';
import { formatCurrency, formatCurrencyPrecise } from '@/lib/pricing/engine';
import { acceptProposal, getProposalDocumentUrl } from '../actions';
import { Button } from '@/components/ui/Button';
import { ProgressSteps } from '@/components/ProgressSteps';
import { addressLine, customerName, formatDate } from '@/lib/format';

interface Props {
  quote: Quote;
  company: Company;
  customer: Customer;
  property: Property;
  pricing: PricingResult;
  levelName: string;
  levelFeatures: string[];
  financeProgramName: string | null;
  salesRepName: string;
  proposal: Proposal | null;
  heroUrl: string | null;
  projectId: string | null;
}

export function ProposalScreen({
  quote,
  company,
  customer,
  property,
  pricing,
  levelName,
  levelFeatures,
  financeProgramName,
  salesRepName,
  proposal,
  heroUrl,
  projectId,
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

  return (
    <div className="min-h-dvh bg-ink pb-44">
      <header className="px-4 pt-safe no-print">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between py-2">
            <Link
              href={sold ? '/dashboard' : `/quotes/${quote.id}/present`}
              className="-ml-2 flex h-11 items-center px-2 text-[15px] font-semibold text-white/60"
            >
              ‹ {sold ? 'Dashboard' : 'Back'}
            </Link>
            <span className="w-14" />
          </div>
          <ProgressSteps current="proposal" tone="dark" />
        </div>
      </header>

      <main className="mx-auto mt-5 max-w-3xl px-4">
        <article className="overflow-hidden rounded-3xl bg-white text-ink shadow-2xl">
          {/* Document header */}
          <div
            className="flex items-start justify-between gap-6 px-6 py-6 text-white"
            style={{ background: 'var(--brand-primary)' }}
          >
            <div className="min-w-0">
              {company.logo_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={company.logo_url} alt={company.name} className="max-h-11 max-w-44 object-contain" />
              ) : (
                <p className="text-xl font-bold tracking-tight">{company.name}</p>
              )}
              <p className="mt-2 text-[11px] leading-relaxed text-white/60">
                {[company.address_line1, [company.city, company.state].filter(Boolean).join(', '), company.zip]
                  .filter(Boolean)
                  .join(' · ')}
                {company.phone ? <><br />{company.phone}</> : null}
                {company.license_number ? <><br />Lic. {company.license_number}</> : null}
              </p>
            </div>
            <div className="shrink-0 text-right text-[11px] leading-relaxed text-white/60">
              Proposal {proposal?.proposal_number ?? '—'}
              <br />
              Quote {quote.quote_number}
              <br />
              {formatDate(proposal?.created_at ?? quote.created_at)}
            </div>
          </div>

          {heroUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={heroUrl} alt="Your home with lighting" className="w-full object-cover" />
          ) : null}

          <div className="space-y-7 px-6 py-7">
            <section>
              <DocHeading>Prepared for</DocHeading>
              <p className="text-2xl font-semibold tracking-tight">{customerName(customer)}</p>
              <p className="mt-1 text-[14px] text-muted">{addressLine(property)}</p>
            </section>

            <section className="grid grid-cols-3 gap-2">
              <DocMetric label="Linear feet" value={String(Number(quote.linear_feet))} />
              <DocMetric label="System" value={levelName} />
              <DocMetric label="Track" value={quote.track_color ?? '—'} />
            </section>

            <section>
              <DocHeading>Your system</DocHeading>
              <ul className="space-y-2">
                {levelFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-[15px] text-ink/80">
                    <span className="mt-[3px] text-[var(--brand-accent)]" aria-hidden>✦</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </section>

            {company.proposal_benefits.length > 0 ? (
              <section>
                <DocHeading>Every installation includes</DocHeading>
                <ul className="space-y-2">
                  {company.proposal_benefits.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2.5 text-[15px] text-ink/80">
                      <span className="mt-[3px] text-[var(--brand-accent)]" aria-hidden>✦</span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section>
              <DocHeading>Investment</DocHeading>
              <dl className="text-[15px]">
                <Line
                  label={`${Number(quote.linear_feet)} linear feet of permanent lighting`}
                  detail={`${formatCurrencyPrecise(pricing.effectivePricePerFoot)} per foot`}
                  amount={formatCurrencyPrecise(pricing.footageSubtotal)}
                />
                {pricing.controllerPrice > 0 ? (
                  <Line
                    label={quote.controller_name ?? 'Controller'}
                    amount={formatCurrencyPrecise(pricing.controllerPrice)}
                  />
                ) : null}
                {pricing.adderLines.map((line) => (
                  <Line key={line.label} label={line.label} detail={line.detail} amount={formatCurrencyPrecise(line.amount)} />
                ))}
                {pricing.discountLines.map((line) => (
                  <Line
                    key={line.label}
                    label={line.label}
                    detail={line.detail}
                    amount={`−${formatCurrencyPrecise(line.amount)}`}
                    credit
                  />
                ))}
                {pricing.dealerFee > 0 ? (
                  <Line label="Financing program fee" amount={formatCurrencyPrecise(pricing.dealerFee)} />
                ) : null}
                {pricing.taxAmount > 0 ? (
                  <Line
                    label="Sales tax"
                    detail={`${(pricing.taxRate * 100).toFixed(3).replace(/\.?0+$/, '')}%`}
                    amount={formatCurrencyPrecise(pricing.taxAmount)}
                  />
                ) : null}

                <div className="mt-3 flex items-baseline justify-between border-t-2 border-[var(--brand-primary)] pt-4">
                  <dt className="text-[17px] font-bold">Total investment</dt>
                  <dd className="text-[24px] font-bold tracking-tight">
                    {formatCurrencyPrecise(pricing.total)}
                  </dd>
                </div>
              </dl>

              {quote.financing_selected && pricing.monthlyPayment > 0 ? (
                <>
                  <div className="mt-4 flex items-center justify-between rounded-2xl border border-[var(--brand-accent)] px-5 py-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                        Monthly payment
                      </p>
                      <p className="mt-0.5 text-[13px] text-ink/70">{financeProgramName ?? 'Financing'}</p>
                    </div>
                    <p className="text-[26px] font-bold tracking-tight">
                      {formatCurrency(pricing.monthlyPayment, { maximumFractionDigits: 0 })}/mo
                    </p>
                  </div>
                  <p className="mt-2 text-[11px] text-muted">
                    Payment shown is an estimate based on the selected program and is subject to lender
                    approval.
                  </p>
                </>
              ) : null}
            </section>

            <section>
              <DocHeading>Warranty</DocHeading>
              <p className="text-[15px] leading-relaxed text-ink/80">{company.warranty_copy}</p>
            </section>

            {sold ? (
              <section className="rounded-2xl bg-ok/10 px-5 py-4">
                <p className="text-[13px] font-bold uppercase tracking-[0.1em] text-ok">Accepted</p>
                <p className="mt-1 text-[15px] text-ink/80">
                  {proposal?.accepted_by_name ?? customerName(customer)} on{' '}
                  {formatDate(quote.sold_at ?? proposal?.accepted_at)}
                </p>
              </section>
            ) : null}

            <p className="border-t border-line pt-4 text-[11px] leading-relaxed text-muted">
              Prepared by {salesRepName} · {company.name}
              {company.website ? ` · ${company.website}` : ''}
            </p>
          </div>
        </article>

        <div className="mt-4 space-y-2 no-print">
          <Button variant="dark" size="lg" fullWidth onClick={openDocument} disabled={openingDoc}>
            {openingDoc ? 'Opening…' : 'Open the stored proposal document'}
          </Button>
          {sold && projectId ? (
            <Link
              href={`/projects/${projectId}`}
              className="flex min-h-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 font-semibold text-white"
            >
              Open the project
            </Link>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="mt-3 rounded-2xl bg-danger/20 px-4 py-3 text-sm font-medium text-red-200">
            {error}
          </p>
        ) : null}
      </main>

      {/* Acceptance */}
      {!sold ? (
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
                ACCEPT THIS PROPOSAL
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DocHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{children}</h2>
  );
}

function DocMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line px-3 py-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-1 truncate text-[17px] font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function Line({
  label,
  detail,
  amount,
  credit,
}: {
  label: string;
  detail?: string;
  amount: string;
  credit?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-3">
      <dt className={credit ? 'text-ok' : ''}>
        {label}
        {detail ? <span className="mt-0.5 block text-[12px] text-muted">{detail}</span> : null}
      </dt>
      <dd className={`shrink-0 tabular-nums ${credit ? 'text-ok' : ''}`}>{amount}</dd>
    </div>
  );
}
