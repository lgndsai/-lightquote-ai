import Link from 'next/link';
import type { Company, CompanyMarketingConfig, Customer, Property, Quote } from '@/lib/types/db';
import type { PricingResult } from '@/lib/pricing/engine';
import { formatCurrency } from '@/lib/pricing/engine';
import type { LongTermComparison } from '@/lib/marketing';
import { addressLine, customerName } from '@/lib/format';
import { ProgressSteps } from '@/components/ProgressSteps';
import { ValueCards } from '@/components/ValueCards';
import { BenefitsGrid } from '@/components/BenefitsGrid';
import { HeroToggle } from './HeroToggle';
import { NextStepCta } from './NextStepCta';

interface Props {
  quote: Quote;
  company: Company;
  customer: Customer;
  property: Property;
  pricing: PricingResult;
  adderLabels: string[];
  financeProgramName: string | null;
  marketing: CompanyMarketingConfig;
  comparison: LongTermComparison;
  originalUrl: string | null;
  heroUrl: string | null;
}

/**
 * The screen the rep hands to the homeowner. Read-only by design — every
 * number here is a recomputation of what was already saved on the
 * measurement screen, never something this screen decides for itself.
 */
export function PresentationScreen({
  quote,
  company,
  customer,
  property,
  pricing,
  adderLabels,
  financeProgramName,
  marketing,
  comparison,
  originalUrl,
  heroUrl,
}: Props) {
  const { retailComparison } = pricing;

  return (
    <div className="bg-luma-surface min-h-dvh">
      <header className="px-4 pt-safe no-print">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between py-2">
            <Link
              href={`/quotes/${quote.id}/measure`}
              className="-ml-2 flex h-11 items-center px-2 text-[15px] font-semibold text-white/60"
            >
              ‹ Edit
            </Link>
            <span className="w-14" />
          </div>
          <ProgressSteps current="proposal" tone="dark" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 pb-44 pt-6">
        {/* Brand + homeowner */}
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            {company.logo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={company.logo_url} alt={company.name} className="h-10 max-w-40 object-contain" />
            ) : (
              <span className="text-xl font-bold tracking-tight text-white">{company.name}</span>
            )}
          </div>
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-accent-soft">Prepared for</p>
            <p className="text-2xl font-semibold tracking-tight text-white">{customerName(customer)}</p>
            <p className="text-[13px] text-white/55">{addressLine(property)}</p>
          </div>
        </div>

        {/* Hero design */}
        <section>
          <h1 className="mb-3 text-center text-[13px] font-bold uppercase tracking-[0.16em] text-white/45">
            Your Custom LumaGlow Design
          </h1>
          <div className="overflow-hidden rounded-3xl ring-1 ring-white/10">
            {heroUrl ? (
              <HeroToggle originalUrl={originalUrl} heroUrl={heroUrl} />
            ) : (
              <div className="aspect-video w-full bg-white/5" />
            )}
          </div>
        </section>

        {/* System design */}
        <section className="grid gap-3 sm:grid-cols-3">
          <SystemStat label="Linear Feet" value={String(Number(quote.linear_feet))} />
          <SystemStat label="Track Color" value={quote.track_color ?? '—'} />
          <SystemStat
            label="Selected Features"
            value={adderLabels.length > 0 ? adderLabels.join(', ') : 'Standard system'}
          />
        </section>

        {/* Investment */}
        <section className="rounded-3xl border border-white/10 bg-white/4 p-6 text-center">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.16em] text-white/45">Your Investment</h2>

          {retailComparison.enabled ? (
            <div className="mx-auto mt-5 grid max-w-md grid-cols-3 gap-3">
              <InvestmentStat label={retailComparison.retailLabel} value={formatCurrency(retailComparison.retailValue)} strike />
              <InvestmentStat label={retailComparison.sellingPriceLabel} value={formatCurrency(retailComparison.standardValue)} />
              <InvestmentStat
                label={retailComparison.savingsLabel}
                value={formatCurrency(Math.max(0, retailComparison.savings))}
                tone="ok"
              />
            </div>
          ) : null}

          <div className="mt-6">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/40">
              {quote.financing_selected ? 'Estimated monthly payment' : 'Total cash price'}
            </p>
            <p className="text-luma-gradient mt-1 text-6xl font-bold tracking-tight">
              {quote.financing_selected
                ? `${formatCurrency(pricing.monthlyPayment, { maximumFractionDigits: 0 })}/mo`
                : formatCurrency(pricing.total)}
            </p>
            {quote.financing_selected && financeProgramName ? (
              <p className="mt-1 text-[13px] text-white/45">{financeProgramName}</p>
            ) : null}
          </div>
        </section>

        <ValueCards config={marketing} comparison={comparison} />

        <BenefitsGrid benefits={marketing.benefits} tone="dark" />
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-ink via-ink/95 to-transparent px-4 pt-8 pb-safe no-print">
        <div className="mx-auto max-w-5xl">
          <p className="mb-2 text-center text-[12px] font-bold uppercase tracking-[0.16em] text-white/40">
            Next Step
          </p>
          <NextStepCta quoteId={quote.id} financing={quote.financing_selected} />
        </div>
      </div>
    </div>
  );
}

function SystemStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 px-4 py-4 text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/40">{label}</p>
      <p className="mt-1 line-clamp-2 text-[15px] font-semibold text-white">{value}</p>
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
