'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { PricingConfig } from '@/lib/pricing/load';
import type { Quote, QuoteAdder } from '@/lib/types/db';
import { calculateQuote, formatCurrency, formatCurrencyPrecise } from '@/lib/pricing/engine';
import { saveQuotePricing } from '../actions';
import { ProgressSteps } from '@/components/ProgressSteps';
import { Button } from '@/components/ui/Button';

const AUTOSAVE_MS = 700;

interface Props {
  quote: Quote;
  config: PricingConfig;
  existingAdders: QuoteAdder[];
}

/**
 * The rep's entire quoting screen. Target: footage in, price out, in under
 * 30 seconds. No price-per-foot typing, no controller step, no discount
 * picker — those were dropped from the production LumaGlow flow. The rep
 * enters linear feet, track color and (optionally) adders; the price is
 * always the company's standard_price_per_ft, calculated server-side.
 */
export function MeasureForm({ quote, config, existingAdders }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [linearFeet, setLinearFeet] = useState(Number(quote.linear_feet) || 0);
  const [feetInput, setFeetInput] = useState(linearFeet ? String(linearFeet) : '');
  const [trackColor, setTrackColor] = useState<string | null>(
    quote.track_color ?? config.trackColors[0]?.name ?? null,
  );
  const [adderQty, setAdderQty] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const row of existingAdders) {
      if (row.catalog_item_id) map[row.catalog_item_id] = Number(row.quantity) || 1;
    }
    return map;
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [financing, setFinancing] = useState(quote.financing_selected);
  const [programId, setProgramId] = useState<string | null>(
    quote.finance_program_id ?? config.financePrograms[0]?.id ?? null,
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const program = config.financePrograms.find((p) => p.id === programId) ?? null;

  const selectedAdders = useMemo(
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

  // The same engine that writes the contract drives this live number —
  // there is no separate "estimate" math anywhere in the UI.
  const preview = useMemo(
    () =>
      calculateQuote({
        linearFeet,
        pricePerFoot: config.pricing.standard_price_per_ft,
        controllerPrice: 0,
        proposalLevel: null,
        adders: selectedAdders,
        discounts: [],
        financing,
        financeProgram: program,
        pricing: config.pricing,
      }),
    [config.pricing, financing, linearFeet, program, selectedAdders],
  );

  const save = useCallback(async () => {
    setSaveState('saving');
    const result = await saveQuotePricing({
      quote_id: quote.id,
      linear_feet: linearFeet,
      track_color: trackColor,
      financing,
      finance_program_id: financing ? programId : null,
      adders: Object.entries(adderQty)
        .filter(([, qty]) => qty > 0)
        .map(([catalog_item_id, quantity]) => ({ catalog_item_id, quantity })),
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
  }, [adderQty, financing, linearFeet, programId, quote.id, trackColor]);

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

  const setFeet = useCallback(
    (next: number) => {
      touch();
      const clamped = Math.max(0, Math.round(next));
      setLinearFeet(clamped);
      setFeetInput(clamped ? String(clamped) : '');
    },
    [touch],
  );

  const toggleAdder = useCallback(
    (id: string) => {
      touch();
      setAdderQty((q) => ({ ...q, [id]: q[id] > 0 ? 0 : 1 }));
    },
    [touch],
  );

  const setAdderQuantity = useCallback(
    (id: string, quantity: number) => {
      touch();
      setAdderQty((q) => ({ ...q, [id]: Math.max(1, quantity) }));
    },
    [touch],
  );

  const activeAdderCount = Object.values(adderQty).filter((q) => q > 0).length;

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
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 pt-safe backdrop-blur-xl">
        <div className="mx-auto max-w-xl px-4 pb-3">
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

      <main className="mx-auto max-w-xl space-y-5 px-4 pt-6 pb-44">
        {/* Linear feet — the one number that drives everything. */}
        <div className="text-center">
          <label htmlFor="linear-feet" className="text-[13px] font-bold uppercase tracking-[0.14em] text-muted">
            Linear Feet
          </label>
          <div className="mt-3 flex items-center justify-center gap-4">
            <StepButton label="Decrease by 10" onClick={() => setFeet(linearFeet - 10)}>
              −
            </StepButton>
            <div className="flex items-baseline">
              <input
                id="linear-feet"
                type="number"
                inputMode="decimal"
                value={feetInput}
                onChange={(event) => {
                  touch();
                  setFeetInput(event.target.value);
                  setLinearFeet(Math.max(0, Number(event.target.value) || 0));
                }}
                placeholder="0"
                className="w-40 border-none bg-transparent text-center text-7xl font-bold tracking-tight text-ink focus:outline-none"
                aria-label="Linear feet"
              />
              <span className="text-2xl font-bold text-muted">FT</span>
            </div>
            <StepButton label="Increase by 10" onClick={() => setFeet(linearFeet + 10)}>
              +
            </StepButton>
          </div>
        </div>

        {/* Track color */}
        {config.trackColors.length > 0 ? (
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold uppercase tracking-wide text-muted">
              Track Color
            </span>
            <select
              value={trackColor ?? ''}
              onChange={(event) => {
                touch();
                setTrackColor(event.target.value || null);
              }}
              className="min-h-14 w-full appearance-none rounded-2xl border border-line bg-card px-4 text-[16px] font-semibold text-ink shadow-sm focus:border-[var(--brand-accent)] focus:outline-none"
            >
              {config.trackColors.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                  {Number(item.price) > 0 ? ` (+${formatCurrency(Number(item.price))})` : ''}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {/* Optional adders — collapsed behind one control, never a wall of toggles. */}
        <div>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-dashed border-line bg-card px-4 text-left shadow-sm"
          >
            <span className="text-[15px] font-semibold text-ink">
              {activeAdderCount > 0 ? `${activeAdderCount} adder${activeAdderCount > 1 ? 's' : ''} added` : 'Add optional adder'}
            </span>
            <span className="text-2xl leading-none text-muted" aria-hidden>
              +
            </span>
          </button>

          {activeAdderCount > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {config.adders
                .filter((item) => (adderQty[item.id] ?? 0) > 0)
                .map((item) => (
                  <span
                    key={item.id}
                    className="flex items-center gap-1.5 rounded-full bg-accent/10 py-1.5 pl-3 pr-2 text-[13px] font-semibold text-ink"
                  >
                    {item.name}
                    {item.unit === 'each' && adderQty[item.id] > 1 ? ` ×${adderQty[item.id]}` : ''}
                    <button
                      type="button"
                      onClick={() => toggleAdder(item.id)}
                      aria-label={`Remove ${item.name}`}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-ink/10 text-[12px]"
                    >
                      ×
                    </button>
                  </span>
                ))}
            </div>
          ) : null}
        </div>

        {/* Simple price presentation */}
        <div className="rounded-3xl border border-line bg-card p-5 shadow-sm">
          {preview.retailComparison.enabled ? (
            <div className="mb-4 grid grid-cols-3 gap-2 border-b border-line pb-4 text-center">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  {preview.retailComparison.retailLabel}
                </p>
                <p className="mt-1 text-lg font-semibold text-muted line-through decoration-2">
                  {formatCurrency(preview.retailComparison.retailValue)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  {preview.retailComparison.sellingPriceLabel}
                </p>
                <p className="mt-1 text-lg font-semibold text-ink">
                  {formatCurrency(preview.retailComparison.standardValue)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-ok">
                  {preview.retailComparison.savingsLabel}
                </p>
                <p className="mt-1 text-lg font-semibold text-ok">
                  {formatCurrency(Math.max(0, preview.retailComparison.savings))}
                </p>
              </div>
            </div>
          ) : null}

          {/* Cash / Finance */}
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-paper p-1">
            <button
              type="button"
              onClick={() => {
                touch();
                setFinancing(false);
              }}
              className={`min-h-12 rounded-xl text-[15px] font-bold transition-colors ${
                !financing ? 'bg-ink text-white shadow' : 'text-muted'
              }`}
            >
              CASH
            </button>
            <button
              type="button"
              disabled={config.financePrograms.length === 0}
              onClick={() => {
                touch();
                setFinancing(true);
              }}
              className={`min-h-12 rounded-xl text-[15px] font-bold transition-colors disabled:opacity-40 ${
                financing ? 'bg-ink text-white shadow' : 'text-muted'
              }`}
            >
              FINANCE
            </button>
          </div>

          {financing && config.financePrograms.length > 0 ? (
            <div className="mb-4 space-y-2">
              {config.financePrograms.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    touch();
                    setProgramId(p.id);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-[13px] ${
                    programId === p.id ? 'border-[var(--brand-accent)] bg-accent/8' : 'border-line'
                  }`}
                >
                  <span className="font-semibold text-ink">{p.name}</span>
                  <span className="text-muted">{p.term_months} mo</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">
              {financing ? 'Estimated monthly payment' : 'Total cash price'}
            </p>
            <p className="mt-1 text-5xl font-bold tracking-tight text-ink">
              {financing
                ? `${formatCurrency(preview.monthlyPayment, { maximumFractionDigits: 0 })}/mo`
                : formatCurrency(preview.total)}
            </p>
          </div>
        </div>

        {/* Advanced details — never shown to the customer, collapsed by default */}
        <div className="no-print">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-[13px] font-semibold text-muted underline-offset-4 hover:underline"
          >
            {showAdvanced ? 'Hide' : 'Show'} advanced details
          </button>
          {showAdvanced ? (
            <div className="mt-2 space-y-1.5 rounded-2xl border border-line bg-card p-4 text-[13px] text-muted">
              <Row label="Rate" value={`${formatCurrencyPrecise(config.pricing.standard_price_per_ft)}/ft`} />
              <Row label="Footage subtotal" value={formatCurrencyPrecise(preview.footageSubtotal)} />
              <Row label="Adders" value={formatCurrencyPrecise(preview.addersTotal)} />
              {preview.dealerFee > 0 ? (
                <Row label="Dealer fee" value={formatCurrencyPrecise(preview.dealerFee)} />
              ) : null}
              <Row label="Tax" value={formatCurrencyPrecise(preview.taxAmount)} />
              <Row label="Total" value={formatCurrencyPrecise(preview.total)} />
            </div>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-paper via-paper/95 to-transparent px-4 pt-8 pb-safe">
        <div className="pointer-events-auto mx-auto max-w-xl">
          <Button variant="primary" size="xl" fullWidth onClick={advance} disabled={pending}>
            {pending ? 'Building…' : 'CONTINUE'}
          </Button>
        </div>
      </div>

      {pickerOpen ? (
        <AdderPicker
          adders={config.adders}
          adderQty={adderQty}
          onToggle={toggleAdder}
          onQuantity={setAdderQuantity}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

function StepButton({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-line bg-card text-3xl font-semibold text-ink no-select shadow-sm active:scale-95"
    >
      {children}
    </button>
  );
}

function AdderPicker({
  adders,
  adderQty,
  onToggle,
  onQuantity,
  onClose,
}: {
  adders: PricingConfig['adders'];
  adderQty: Record<string, number>;
  onToggle: (id: string) => void;
  onQuantity: (id: string, quantity: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-card p-4 pb-safe shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-semibold text-ink">Optional adders</h2>
          <button type="button" onClick={onClose} className="text-[15px] font-semibold text-muted">
            Done
          </button>
        </div>

        <div className="space-y-2">
          {adders.map((item) => {
            const quantity = adderQty[item.id] ?? 0;
            const on = quantity > 0;
            return (
              <div
                key={item.id}
                className={`rounded-2xl border p-4 transition-colors ${
                  on ? 'border-[var(--brand-accent)] bg-accent/8' : 'border-line'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onToggle(item.id)}
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
                      on ? 'bg-[var(--brand-accent)] text-white' : 'border border-line text-muted'
                    }`}
                    aria-hidden
                  >
                    {on ? '✓' : '+'}
                  </span>
                </button>

                {on && item.unit === 'each' ? (
                  <div className="mt-3 flex items-center justify-end gap-3 border-t border-line/70 pt-3">
                    <span className="text-[13px] font-semibold text-muted">Quantity</span>
                    <button
                      type="button"
                      onClick={() => onQuantity(item.id, quantity - 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-lg font-semibold"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-lg font-semibold text-ink">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => onQuantity(item.id, quantity + 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-lg font-semibold"
                    >
                      +
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function unitLabel(unit: string, price: number) {
  if (unit === 'per_foot') return `${formatCurrencyPrecise(price)} per foot`;
  if (unit === 'each') return `${formatCurrency(price)} per quantity`;
  if (unit === 'percent') return `${price}% of the system`;
  return formatCurrency(price);
}
