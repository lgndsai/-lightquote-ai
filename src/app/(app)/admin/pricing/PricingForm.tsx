'use client';

import { useActionState } from 'react';
import type { CompanyPricing, ProposalLevel } from '@/lib/types/db';
import { updatePricing, type AdminState } from '../actions';
import { TextField, TextArea } from '@/components/ui/Field';
import { FormMessage, SubmitButton } from '@/components/ui/SubmitBar';
import { Card, SectionTitle } from '@/components/ui/Card';

export function PricingForm({
  pricing,
  proposalLevels,
}: {
  pricing: CompanyPricing;
  proposalLevels: ProposalLevel[];
}) {
  const [state, action] = useActionState<AdminState, FormData>(updatePricing, {});

  return (
    <main className="mx-auto max-w-3xl px-4 pt-5 pb-16">
      <h1 className="mb-1 text-[26px] font-semibold tracking-tight text-ink">Pricing</h1>
      <p className="mb-5 text-[15px] text-muted">
        Every quote screen reads these values. Nothing here is hardcoded in the app.
      </p>

      <form action={action} className="space-y-6">
        <div>
          <SectionTitle>Per foot</SectionTitle>
          <Card className="grid grid-cols-2 gap-3">
            <TextField
              name="suggested_price_per_foot"
              label="Suggested"
              type="number"
              step="0.01"
              inputMode="decimal"
              defaultValue={String(pricing.suggested_price_per_foot)}
              hint="$"
              required
            />
            <TextField
              name="min_price_per_foot"
              label="Minimum"
              type="number"
              step="0.01"
              inputMode="decimal"
              defaultValue={String(pricing.min_price_per_foot)}
              hint="$"
              required
            />
          </Card>
        </div>

        <div>
          <SectionTitle>Defaults and fees</SectionTitle>
          <Card className="space-y-3">
            <TextField
              name="controller_price"
              label="Default controller price"
              type="number"
              step="0.01"
              inputMode="decimal"
              defaultValue={String(pricing.controller_price)}
              hint="$"
            />
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
              hint="0.12 = 12%"
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

        <div>
          <SectionTitle>Proposal levels</SectionTitle>
          <Card>
            <TextArea
              name="proposal_levels"
              label="Levels (JSON)"
              defaultValue={JSON.stringify(proposalLevels, null, 2)}
              className="[&>textarea]:font-mono"
              rows={18}
            />
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              An array of {'{ key, name, description, price_per_foot_delta, features[] }'}.
              price_per_foot_delta shifts the rep&rsquo;s per-foot price for that level.
            </p>
          </Card>
        </div>

        <FormMessage error={state.error} message={state.message} />
        <SubmitButton />
      </form>
    </main>
  );
}
