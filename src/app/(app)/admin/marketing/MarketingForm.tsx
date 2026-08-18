'use client';

import { useActionState } from 'react';
import type { CompanyMarketingConfig } from '@/lib/types/db';
import { updateMarketingConfig, type AdminState } from '../actions';
import { TextField, TextArea } from '@/components/ui/Field';
import { FormMessage, SubmitButton } from '@/components/ui/SubmitBar';
import { Card, SectionTitle } from '@/components/ui/Card';

export function MarketingForm({ config }: { config: CompanyMarketingConfig }) {
  const [state, action] = useActionState<AdminState, FormData>(updateMarketingConfig, {});

  return (
    <main className="mx-auto max-w-3xl px-4 pt-5 pb-16">
      <h1 className="mb-1 text-[26px] font-semibold tracking-tight text-ink">Marketing &amp; proposal value</h1>
      <p className="mb-5 text-[15px] text-muted">
        Everything shown in &ldquo;The Value of Going Permanent&rdquo; on the customer proposal —
        wording, statistics, sources and disclaimers all live here, never in code.
      </p>

      <form action={action} className="space-y-6">
        <div>
          <SectionTitle>Card 1 — Long-term cost comparison</SectionTitle>
          <Card className="space-y-3">
            <Toggle
              name="show_long_term_comparison"
              label="Show this card"
              defaultChecked={config.show_long_term_comparison}
            />
            <TextField
              name="alternative_name"
              label="Alternative name"
              defaultValue={config.alternative_name}
              hint="e.g. Budget Installed Lighting, or a specific competitor if the rep has a real quote"
              required
            />
            <div className="grid grid-cols-3 gap-3">
              <TextField
                name="alternative_installed_cost"
                label="Installed cost"
                type="number"
                step="0.01"
                inputMode="decimal"
                defaultValue={String(config.alternative_installed_cost)}
                hint="$"
                required
              />
              <TextField
                name="alternative_replacement_interval_years"
                label="Replacement interval"
                type="number"
                step="0.5"
                inputMode="decimal"
                defaultValue={String(config.alternative_replacement_interval_years)}
                hint="years"
                required
              />
              <TextField
                name="comparison_horizon_years"
                label="Comparison horizon"
                type="number"
                step="1"
                inputMode="decimal"
                defaultValue={String(config.comparison_horizon_years)}
                hint="years"
                required
              />
            </div>
            <TextArea
              name="comparison_disclaimer"
              label="Disclaimer"
              defaultValue={config.comparison_disclaimer}
            />
            <p className="text-[12px] leading-relaxed text-muted">
              These are illustrative, company-provided assumptions — never a manufacturer lifespan
              claim. If a rep enters a real competitor quote, the proposal will say so.
            </p>
          </Card>
        </div>

        <div>
          <SectionTitle>Card 2 — Resale appeal</SectionTitle>
          <Card className="space-y-3">
            <Toggle name="show_resale_stat" label="Show the primary resale statistic" defaultChecked={config.show_resale_stat} />
            <div className="grid grid-cols-2 gap-3">
              <TextField name="resale_headline" label="Headline" defaultValue={config.resale_headline} required />
              <TextField name="resale_label" label="Label" defaultValue={config.resale_label} required />
            </div>
            <TextArea name="resale_body" label="Supporting copy" defaultValue={config.resale_body} />
            <TextField name="resale_source" label="Source" defaultValue={config.resale_source} />
            <TextArea name="resale_disclaimer" label="Disclaimer" defaultValue={config.resale_disclaimer} />

            <div className="border-t border-line pt-3">
              <Toggle
                name="show_secondary_resale_stat"
                label="Also show a secondary resale statistic (off by default)"
                defaultChecked={config.show_secondary_resale_stat}
              />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <TextField
                  name="secondary_resale_headline"
                  label="Headline"
                  defaultValue={config.secondary_resale_headline}
                  required
                />
                <TextField
                  name="secondary_resale_label"
                  label="Label"
                  defaultValue={config.secondary_resale_label}
                  required
                />
              </div>
              <TextArea
                name="secondary_resale_body"
                label="Supporting copy"
                defaultValue={config.secondary_resale_body}
                className="mt-3"
              />
              <TextField
                name="secondary_resale_source"
                label="Source"
                defaultValue={config.secondary_resale_source}
                className="mt-3"
              />
              <TextArea
                name="secondary_resale_disclaimer"
                label="Disclaimer"
                defaultValue={config.secondary_resale_disclaimer}
                className="mt-3"
              />
            </div>
          </Card>
        </div>

        <div>
          <SectionTitle>Card 3 — Security / visibility</SectionTitle>
          <Card className="space-y-3">
            <Toggle name="show_security_stat" label="Show this card" defaultChecked={config.show_security_stat} />
            <TextField name="security_headline" label="Headline" defaultValue={config.security_headline} required />
            <TextArea name="security_body" label="Supporting copy" defaultValue={config.security_body} />
            <TextField
              name="security_secondary_line"
              label="Secondary line"
              defaultValue={config.security_secondary_line}
            />
            <TextField name="security_source" label="Source" defaultValue={config.security_source} />
            <TextArea name="security_disclaimer" label="Disclaimer" defaultValue={config.security_disclaimer} />
          </Card>
        </div>

        <div>
          <SectionTitle>Why LumaGlow — benefit cards</SectionTitle>
          <Card>
            <TextArea
              name="benefits"
              label="Benefits (JSON, max 6)"
              defaultValue={JSON.stringify(config.benefits, null, 2)}
              rows={16}
            />
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              An array of {'{ title, body }'}. Shown under &ldquo;Why LumaGlow&rdquo; on the proposal —
              capped at 6 so the homeowner is never overwhelmed.
            </p>
          </Card>
        </div>

        <FormMessage error={state.error} message={state.message} />
        <SubmitButton />
      </form>
    </main>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-line px-4">
      <span className="text-[15px] font-semibold text-ink">{label}</span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-6 w-6 shrink-0 accent-[var(--brand-primary)]"
      />
    </label>
  );
}
