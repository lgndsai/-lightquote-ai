'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { PricingConfig } from '@/lib/pricing/load';
import type { Quote, QuoteAdder } from '@/lib/types/db';
import {
  calculateQuote,
  formatCurrency,
  toSelectedDiscount,
  type SelectedAdder,
} from '@/lib/pricing/engine';
import { saveQuotePricing } from '../actions';
import { ProgressSteps } from '@/components/ProgressSteps';
import { Button } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';

const AUTOSAVE_MS = 700;

interface Props {
  quote: Quote;
  config: PricingConfig;
  existingAdders: QuoteAdder[];
}

export function MeasureForm({ quote, config, existingAdders }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [linearFeet, setLinearFeet] = useState(Number(quote.linear_feet) || 0);
  const [pricePerFoot, setPricePerFoot] = useState(
    Number(quote.price_per_foot) || Number(config.pricing.suggested_price_per_foot) || 0,
  );
  const [trackColor, setTrackColor] = useState<string | null>(quote.track_color);
  const [controllerId, setControllerId] = useState<string | null>(
    config.controllers.find((c) => c.name === quote.controller_name)?.id ??
      config.controllers[0]?.id ??
      null,
  );
  const [adderQty, setAdderQty] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const row of existingAdders) {
      if (row.catalog_item_id) map[row.catalog_item_id] = Number(row.quantity) || 1;
    }
    return map;
  });
  const [discountIds, setDiscountIds] = useState<string[]>(quote.selected_discount_ids ?? []);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const controller = config.controllers.find((c) => c.id === controllerId) ?? null;
  const level = config.proposalLevels.find((l) => l.key === quote.proposal_level) ?? null;

  const selectedAdders: SelectedAdder[] = useMemo(
    () =>
      config.adders.flatMap((item) => {
        const quantity = adderQty[item.id] ?? 0;
        if (quantity <= 0) return [];
        return [
          {
            catalog_item_id: item.id,
            name: item.name,
            unit: item.unit,
            unit_price: Number(item.price),
            quantity,
          },
        ];
      }),
    [adderQty, config.adders],
  );

  // The engine is pure, so the same function that writes the contract also
  // drives the live figure the rep is looking at.
  const preview = useMemo(
    () =>
      calculateQuote({
        linearFeet,
        pricePerFoot,
        controllerPrice: controller ? Number(controller.price) : Number(config.pricing.controller_price),
        proposalLevel: level,
        adders: selectedAdders,
        discounts: config.discounts
          .filter((d) => discountIds.includes(d.id))
          .map(toSelectedDiscount),
        financing: quote.financing_selected,
        financeProgram: config.financePrograms.find((p) => p.id === quote.finance_program_id) ?? null,
        pricing: config.pricing,
      }),
    [
      config,
      controller,
      discountIds,
      level,
      linearFeet,
      pricePerFoot,
      quote.finance_program_id,
      quote.financing_selected,
      selectedAdders,
    ],
  );

  const save = useCallback(async () => {
    setSaveState('saving');
    const result = await saveQuotePricing({
      quote_id: quote.id,
      linear_feet: linearFeet,
      price_per_foot: pricePerFoot,
      track_color: trackColor,
      controller_item_id: controllerId,
      proposal_level: quote.proposal_level,
      financing: quote.financing_selected,
      finance_program_id: quote.finance_program_id,
      adders: Object.entries(adderQty)
        .filter(([, qty]) => qty > 0)
        .map(([catalog_item_id, quantity]) => ({ catalog_item_id, quantity })),
      discount_ids: discountIds,
    });

    if (result.error) {
      setSaveState('error');
      setError(result.error);
      return false;
    }
    dirtyRef.current = false;
    setSaveState('saved');
    setError(null);
    return true;
  }, [
    adderQty,
    controllerId,
    discountIds,
    linearFeet,
    pricePerFoot,
    quote.finance_program_id,
    quote.financing_selected,
    quote.id,
    quote.proposal_level,
    trackColor,
  ]);

  useEffect(() => {
    if (!dirtyRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [save]);

  const touch = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  const advance = useCallback(() => {
    if (linearFeet <= 0) {
      setError('Enter the linear footage to price the job.');
      return;
    }
    startTransition(async () => {
      const ok = await save();
      if (ok) router.push(`/quotes/${quote.id}/present`);
    });
  }, [linearFeet, quote.id, router, save]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 pt-safe backdrop-blur-xl">
        <div className="mx-auto max-w-2xl px-4 pb-3">
          <div className="mb-3 flex items-center justify-between">
            <Link
              href={`/quotes/${quote.id}/visualization`}
              className="-ml-2 flex h-11 items-center px-2 text-[15px] font-semibold text-muted"
            >
              ‹ Preview
            </Link>
            <span className="text-[12px] font-semibold text-muted">
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : ''}
            </span>
            <span className="w-16" />
          </div>
          <ProgressSteps current="price" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 pt-5 pb-44">
        <div>
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-ink">
            System measurements
          </h1>
          <p className="mt-1 text-[15px] text-muted">{quote.quote_number}</p>
        </div>

        {/* Linear feet — the one number that drives everything. */}
        <Card>
          <SectionTitle>Linear feet</SectionTitle>
          <div className="flex items-center gap-3">
            <StepButton label="Decrease by 10" onClick={() => { touch(); setLinearFeet((f) => Math.max(0, f - 10)); }}>
              −
            </StepButton>
            <input
              type="number"
              inputMode="decimal"
              value={linearFeet || ''}
              onChange={(event) => {
                touch();
                setLinearFeet(Math.max(0, Number(event.target.value) || 0));
              }}
              placeholder="0"
              className="min-h-16 w-full rounded-2xl border border-line bg-paper text-center text-4xl font-semibold tracking-tight text-ink focus:border-[var(--brand-accent)] focus:outline-none"
              aria-label="Linear feet"
            />
            <StepButton label="Increase by 10" onClick={() => { touch(); setLinearFeet((f) => f + 10); }}>
              +
            </StepButton>
          </div>
        </Card>

        <Card>
          <SectionTitle>Price per foot</SectionTitle>
          <div className="flex items-center gap-3">
            <StepButton label="Decrease by 1" onClick={() => { touch(); setPricePerFoot((p) => Math.max(0, p - 1)); }}>
              −
            </StepButton>
            <div className="relative w-full">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-2xl font-semibold text-muted">
                $
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                value={pricePerFoot || ''}
                  onChange={(event) => {
                  touch();
                  setPricePerFoot(Math.max(0, Number(event.target.value) || 0));
                }}
                className="min-h-16 w-full rounded-2xl border border-line bg-paper text-center text-3xl font-semibold tracking-tight text-ink focus:border-[var(--brand-accent)] focus:outline-none"
                aria-label="Price per foot"
              />
            </div>
            <StepButton label="Increase by 1" onClick={() => { touch(); setPricePerFoot((p) => p + 1); }}>
              +
            </StepButton>
          </div>
          {preview.belowMinimumPricePerFoot ? (
            <p className="mt-3 rounded-xl bg-warn/10 px-3 py-2 text-[13px] font-semibold text-warn">
              Below the company minimum of {formatCurrency(config.pricing.min_price_per_foot, { maximumFractionDigits: 2 })} per foot.
            </p>
          ) : null}
        </Card>

        {config.trackColors.length > 0 ? (
          <div>
            <SectionTitle>Track color</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {config.trackColors.map((item) => (
                <ChoiceTile
                  key={item.id}
                  selected={trackColor === item.name}
                  onClick={() => { touch(); setTrackColor(item.name); }}
                  title={item.name}
                  subtitle={Number(item.price) > 0 ? `+${formatCurrency(Number(item.price))}` : 'Included'}
                />
              ))}
            </div>
          </div>
        ) : null}

        {config.controllers.length > 0 ? (
          <div>
            <SectionTitle>Controller</SectionTitle>
            <div className="space-y-2">
              {config.controllers.map((item) => (
                <ChoiceTile
                  key={item.id}
                  selected={controllerId === item.id}
                  onClick={() => { touch(); setControllerId(item.id); }}
                  title={item.name}
                  subtitle={item.description ?? undefined}
                  amount={formatCurrency(Number(item.price))}
                />
              ))}
            </div>
          </div>
        ) : null}

        {config.adders.length > 0 ? (
          <div>
            <SectionTitle>Optional adders</SectionTitle>
            <div className="space-y-2">
              {config.adders.map((item) => {
                const quantity = adderQty[item.id] ?? 0;
                const on = quantity > 0;
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 transition-colors ${
                      on ? 'border-[var(--brand-accent)] bg-accent/8' : 'border-line bg-card'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        touch();
                        setAdderQty((q) => ({ ...q, [item.id]: on ? 0 : 1 }));
                      }}
                      className="flex w-full items-start justify-between gap-3 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block text-[16px] font-semibold text-ink">{item.name}</span>
                        {item.description ? (
                          <span className="mt-0.5 block text-[13px] text-muted">{item.description}</span>
                        ) : null}
                        <span className="mt-1 block text-[13px] font-semibold text-muted">
                          {unitLabel(item.unit, Number(item.price))}
                        </span>
                      </span>
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[15px] font-bold ${
                          on ? 'bg-[var(--brand-accent)] text-ink' : 'border border-line text-muted'
                        }`}
                        aria-hidden
                      >
                        {on ? '✓' : '+'}
                      </span>
                    </button>

                    {on && item.unit === 'each' ? (
                      <div className="mt-3 flex items-center justify-end gap-3 border-t border-line/70 pt-3">
                        <span className="text-[13px] font-semibold text-muted">Quantity</span>
                        <StepButton
                          small
                          label="Decrease quantity"
                          onClick={() => {
                            touch();
                            setAdderQty((q) => ({ ...q, [item.id]: Math.max(1, (q[item.id] ?? 1) - 1) }));
                          }}
                        >
                          −
                        </StepButton>
                        <span className="w-8 text-center text-lg font-semibold text-ink">{quantity}</span>
                        <StepButton
                          small
                          label="Increase quantity"
                          onClick={() => {
                            touch();
                            setAdderQty((q) => ({ ...q, [item.id]: (q[item.id] ?? 1) + 1 }));
                          }}
                        >
                          +
                        </StepButton>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {config.discounts.length > 0 ? (
          <div>
            <SectionTitle>Discounts</SectionTitle>
            <div className="space-y-2">
              {config.discounts.map((item) => (
                <ChoiceTile
                  key={item.id}
                  selected={discountIds.includes(item.id)}
                  onClick={() => {
                    touch();
                    setDiscountIds((ids) =>
                      ids.includes(item.id) ? ids.filter((i) => i !== item.id) : [...ids, item.id],
                    );
                  }}
                  title={item.name}
                  subtitle={item.description ?? undefined}
                  amount={item.unit === 'percent' ? `−${Number(item.price)}%` : `−${formatCurrency(Number(item.price))}`}
                />
              ))}
            </div>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-paper via-paper/95 to-transparent px-4 pt-8 pb-safe">
        <div className="pointer-events-auto mx-auto max-w-2xl space-y-2.5">
          <div className="flex items-baseline justify-between rounded-2xl border border-line bg-card px-4 py-3 shadow-sm">
            <span className="text-[13px] font-bold uppercase tracking-[0.1em] text-muted">Cash price</span>
            <span className="text-2xl font-semibold tracking-tight text-ink">
              {formatCurrency(preview.total)}
            </span>
          </div>
          <Button variant="primary" size="xl" fullWidth onClick={advance} disabled={pending}>
            {pending ? 'Building…' : 'CONTINUE'}
          </Button>
        </div>
      </div>
    </>
  );
}

function unitLabel(unit: string, price: number) {
  if (unit === 'per_foot') return `${formatCurrency(price, { maximumFractionDigits: 2 })} per foot`;
  if (unit === 'each') return `${formatCurrency(price)} each`;
  if (unit === 'percent') return `${price}% of the system`;
  return formatCurrency(price);
}

function StepButton({
  children,
  onClick,
  label,
  small,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex shrink-0 items-center justify-center rounded-2xl border border-line bg-card font-semibold text-ink no-select active:scale-95 ${
        small ? 'h-10 w-10 text-xl' : 'h-16 w-16 text-3xl'
      }`}
    >
      {children}
    </button>
  );
}

function ChoiceTile({
  selected,
  onClick,
  title,
  subtitle,
  amount,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  amount?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
        selected ? 'border-[var(--brand-accent)] bg-accent/8' : 'border-line bg-card'
      }`}
    >
      <span className="min-w-0">
        <span className="block text-[16px] font-semibold text-ink">{title}</span>
        {subtitle ? <span className="mt-0.5 block text-[13px] text-muted">{subtitle}</span> : null}
      </span>
      {amount ? <span className="shrink-0 text-[15px] font-semibold text-muted">{amount}</span> : null}
    </button>
  );
}
