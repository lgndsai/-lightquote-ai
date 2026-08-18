'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { PricingConfig } from '@/lib/pricing/load';
import type { Company, Customer, Property, Quote, QuoteAdder } from '@/lib/types/db';
import {
  calculateQuote,
  formatCurrency,
  fromQuoteAdder,
  toSelectedDiscount,
} from '@/lib/pricing/engine';
import { createProposal, saveQuotePricing } from '../actions';
import { Button } from '@/components/ui/Button';
import { ProgressSteps } from '@/components/ProgressSteps';
import { addressLine, customerName } from '@/lib/format';

interface Props {
  quote: Quote;
  company: Company;
  customer: Customer;
  property: Property;
  config: PricingConfig;
  adders: QuoteAdder[];
  heroUrl: string | null;
}

export function PresentationScreen({
  quote,
  company,
  customer,
  property,
  config,
  adders,
  heroUrl,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [levelKey, setLevelKey] = useState(quote.proposal_level);
  const [financing, setFinancing] = useState(quote.financing_selected);
  const [programId, setProgramId] = useState<string | null>(
    quote.finance_program_id ?? config.financePrograms[0]?.id ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  const selectedAdders = useMemo(() => adders.map(fromQuoteAdder), [adders]);
  const selectedDiscounts = useMemo(
    () =>
      config.discounts
        .filter((d) => (quote.selected_discount_ids ?? []).includes(d.id))
        .map(toSelectedDiscount),
    [config.discounts, quote.selected_discount_ids],
  );

  const program = config.financePrograms.find((p) => p.id === programId) ?? null;

  /** Prices every level so the customer sees three real numbers side by side. */
  const priced = useMemo(
    () =>
      config.proposalLevels.map((level) => ({
        level,
        result: calculateQuote({
          linearFeet: Number(quote.linear_feet),
          pricePerFoot: Number(quote.price_per_foot),
          controllerPrice: Number(quote.controller_price),
          proposalLevel: level,
          adders: selectedAdders,
          discounts: selectedDiscounts,
          financing,
          financeProgram: program,
          pricing: config.pricing,
        }),
      })),
    [config, financing, program, quote, selectedAdders, selectedDiscounts],
  );

  const active = priced.find((p) => p.level.key === levelKey) ?? priced[1] ?? priced[0];

  const persist = useCallback(
    (nextLevel: string, nextFinancing: boolean, nextProgramId: string | null) =>
      saveQuotePricing({
        quote_id: quote.id,
        linear_feet: Number(quote.linear_feet),
        price_per_foot: Number(quote.price_per_foot),
        track_color: quote.track_color,
        controller_item_id:
          config.controllers.find((c) => c.name === quote.controller_name)?.id ?? null,
        proposal_level: nextLevel,
        financing: nextFinancing,
        finance_program_id: nextProgramId,
        adders: adders
          .filter((a) => a.catalog_item_id)
          .map((a) => ({ catalog_item_id: a.catalog_item_id as string, quantity: Number(a.quantity) })),
        discount_ids: quote.selected_discount_ids ?? [],
      }),
    [adders, config.controllers, quote],
  );

  const buildProposal = useCallback(() => {
    startTransition(async () => {
      const result = await persist(levelKey, financing, financing ? programId : null);
      if (result.error) {
        setError(result.error);
        return;
      }

      const built = await createProposal(quote.id);
      if (built.error) {
        setError(built.error);
        return;
      }

      router.push(`/quotes/${quote.id}/proposal`);
    });
  }, [financing, levelKey, persist, programId, quote.id, router]);

  return (
    <div className="min-h-dvh bg-ink">
      {/* Hero: the customer's own home, rendered. */}
      <div className="relative h-[46vh] min-h-72 w-full overflow-hidden">
        {heroUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={heroUrl} alt="Your home with lighting" className="h-full w-full object-cover" />
        ) : (
          <div className="shimmer h-full w-full" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-ink/60" />

        <div className="absolute inset-x-0 top-0 px-4 pt-safe">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center justify-between py-2">
              <Link
                href={`/quotes/${quote.id}/measure`}
                className="-ml-2 flex h-11 items-center px-2 text-[15px] font-semibold text-white/70"
              >
                ‹ Edit
              </Link>
              <span className="w-14" />
            </div>
            <ProgressSteps current="price" tone="dark" />
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
          <div className="mx-auto max-w-3xl">
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-accent">
              Prepared for
            </p>
            <h1 className="mt-1 text-[30px] font-semibold leading-tight tracking-tight text-white">
              {customerName(customer)}
            </h1>
            <p className="mt-1 text-[14px] text-white/60">{addressLine(property)}</p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl space-y-8 px-4 pt-7 pb-44">
        {/* System summary */}
        <section className="grid grid-cols-3 gap-2">
          <Metric label="Linear feet" value={String(Number(quote.linear_feet))} />
          <Metric label="Track" value={quote.track_color ?? '—'} />
          <Metric label="Controller" value={quote.controller_name ?? '—'} />
        </section>

        {/* Proposal levels */}
        <section>
          <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.16em] text-white/40">
            Choose your system
          </h2>
          <div className="space-y-3">
            {priced.map(({ level, result }) => {
              const selected = level.key === active?.level.key;
              return (
                <button
                  key={level.key}
                  type="button"
                  onClick={() => setLevelKey(level.key)}
                  className={`w-full rounded-3xl border p-5 text-left transition-colors ${
                    selected
                      ? 'border-accent bg-white/8 shadow-[0_0_50px_rgba(200,162,74,0.18)]'
                      : 'border-white/10 bg-white/4'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[19px] font-semibold tracking-tight text-white">{level.name}</p>
                      <p className="mt-1 text-[13px] leading-snug text-white/50">{level.description}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[22px] font-semibold tracking-tight text-white">
                        {formatCurrency(result.total)}
                      </p>
                      {financing && result.monthlyPayment > 0 ? (
                        <p className="text-[13px] font-semibold text-accent">
                          {formatCurrency(result.monthlyPayment, { maximumFractionDigits: 0 })}/mo
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {selected ? (
                    <ul className="mt-4 space-y-2 border-t border-white/10 pt-4">
                      {level.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5 text-[14px] text-white/75">
                          <span className="mt-[3px] text-accent" aria-hidden>
                            ✦
                          </span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        {/* Financing */}
        {config.financePrograms.length > 0 ? (
          <section>
            <div className="flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/4 p-5">
              <div>
                <p className="text-[16px] font-semibold text-white">Monthly payment</p>
                <p className="mt-0.5 text-[13px] text-white/50">Show financing instead of cash</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={financing}
                onClick={() => setFinancing((f) => !f)}
                className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                  financing ? 'bg-accent' : 'bg-white/15'
                }`}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-transform ${
                    financing ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {financing ? (
              <div className="mt-3 space-y-2">
                {config.financePrograms.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProgramId(p.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                      programId === p.id ? 'border-accent bg-accent/10' : 'border-white/10 bg-white/4'
                    }`}
                  >
                    <span>
                      <span className="block text-[15px] font-semibold text-white">{p.name}</span>
                      <span className="block text-[12px] text-white/45">
                        {p.term_months} months{p.provider ? ` · ${p.provider}` : ''}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {/* What's included */}
        {company.proposal_benefits.length > 0 ? (
          <section>
            <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.16em] text-white/40">
              Every installation includes
            </h2>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {company.proposal_benefits.map((benefit) => (
                <li
                  key={benefit}
                  className="flex items-start gap-2.5 rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-[14px] text-white/75"
                >
                  <span className="mt-[3px] text-accent" aria-hidden>
                    ✦
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-3xl border border-white/8 bg-white/4 p-5">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.16em] text-white/40">Warranty</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-white/70">{company.warranty_copy}</p>
        </section>

        {error ? (
          <p role="alert" className="rounded-2xl bg-danger/20 px-4 py-3 text-sm font-medium text-red-200">
            {error}
          </p>
        ) : null}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-ink via-ink/95 to-transparent px-4 pt-8 pb-safe">
        <div className="mx-auto max-w-3xl space-y-2.5">
          <div className="flex items-baseline justify-between px-1">
            <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-white/45">
              {financing ? 'Monthly investment' : 'Cash investment'}
            </span>
            <span className="text-[28px] font-semibold tracking-tight text-white">
              {financing && active
                ? `${formatCurrency(active.result.monthlyPayment, { maximumFractionDigits: 0 })}/mo`
                : formatCurrency(active?.result.total ?? 0)}
            </span>
          </div>
          <Button variant="accent" size="xl" fullWidth onClick={buildProposal} disabled={pending}>
            {pending ? 'Preparing…' : 'BUILD PROPOSAL'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">{label}</p>
      <p className="mt-1 truncate text-[17px] font-semibold tracking-tight text-white">{value}</p>
    </div>
  );
}
