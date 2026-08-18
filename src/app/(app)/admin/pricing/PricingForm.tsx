'use client';

import { useActionState } from 'react';
import type { CompanyPricing } from '@/lib/types/db';
import { updatePricing, type AdminState } from '../actions';
import { TextField } from '@/components/ui/Field';
import { FormMessage, SubmitButton } from '@/components/ui/SubmitBar';
import { Card, SectionTitle } from '@/components/ui/Card';

export function PricingForm({ pricing }: { pricing: CompanyPricing }) {
  const [state, action] = useActionState<AdminState, FormData>(updatePricing, {});

  return (
    <main className="mx-auto max-w-3xl px-4 pt-5 pb-16">
      <h1 className="mb-1 text-[26px] font-semibold tracking-tight text-ink">Pricing</h1>
      <p className="mb-5 text-[15px] text-muted">
        The rep quoting screen reads these values directly — nothing about price lives in a
        component. standard_price_per_ft is the one rate every job is calculated from.
      </p>

      <form action={action} className="space-y-6">
        <div>
          <SectionTitle>Per foot rate</SectionTitle>
          <Card className="grid grid-cols-2 gap-3">
            <TextField
              name="retail_price_per_ft"
              label="Retail price / ft"
              type="number"
              step="0.01"
              inputMode="decimal"
              defaultValue={String(pricing.retail_price_per_ft)}
              hint="$ — comparison only"
              required
            />
            <TextField
              name="standard_price_per_ft"
              label="Standard selling price / ft"
              type="number"
              step="0.01"
              inputMode="decimal"
              defaultValue={String(pricing.standard_price_per_ft)}
              hint="$ — the real rate"
              required
            />
          </Card>
        </div>

        <div>
          <SectionTitle>Value presentation</SectionTitle>
          <Card className="space-y-3">
            <label className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-line px-4">
              <span>
                <span className="block text-[15px] font-semibold text-ink">Show retail comparison</span>
                <span className="block text-[12px] text-muted">
                  Displays retail vs. standard price and the savings on the quoting and
                  presentation screens.
                </span>
              </span>
              <input
                type="checkbox"
                name="show_retail_comparison"
                defaultChecked={pricing.show_retail_comparison}
                className="h-6 w-6 shrink-0 accent-[var(--brand-primary)]"
              />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextField
                name="retail_label"
                label="Retail label"
                defaultValue={pricing.retail_label}
                required
              />
              <TextField
                name="selling_price_label"
                label="Selling price label"
                defaultValue={pricing.selling_price_label}
                required
              />
              <TextField
                name="savings_label"
                label="Savings label"
                defaultValue={pricing.savings_label}
                required
              />
            </div>
          </Card>
        </div>

        <div>
          <SectionTitle>Fees</SectionTitle>
          <Card className="space-y-3">
            <TextField
              name="minimum_job_price"
              label="Minimum job price"
              type="number"
              step="0.01"
              inputMode="decimal"
              defaultValue={String(pricing.minimum_job_price)}
              hint="$ — 0 disables"
            />
            <TextField
              name="dealer_fee_percent"
              label="Default dealer fee"
              type="number"
              step="0.0001"
              inputMode="decimal"
              defaultValue={String(pricing.dealer_fee_percent)}
              hint="0.12 = 12% — applies when a job is financed"
            />
          </Card>
        </div>

        <div>
          <SectionTitle>Tax</SectionTitle>
          <Card className="space-y-3">
            <TextField
              name="tax_rate"
              label="Sales tax rate"
              type="number"
              step="0.0001"
              inputMode="decimal"
              defaultValue={String(pricing.tax_rate)}
              hint="0.0825 = 8.25%"
            />
            <label className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-line px-4">
              <span className="text-[15px] font-semibold text-ink">Tax installation labor</span>
              <input
                type="checkbox"
                name="tax_on_labor"
                defaultChecked={pricing.tax_on_labor}
                className="h-6 w-6 accent-[var(--brand-primary)]"
              />
            </label>
            <TextField
              name="labor_percent_of_price"
              label="Labor share of the per-foot price"
              type="number"
              step="0.01"
              inputMode="decimal"
              defaultValue={String(pricing.labor_percent_of_price)}
              hint="0.5 = 50%, used when labor is untaxed"
            />
          </Card>
        </div>

        <FormMessage error={state.error} message={state.message} />
        <SubmitButton />
      </form>
    </main>
  );
}
