'use client';

import { useState } from 'react';
import type { CompanyMarketingConfig } from '@/lib/types/db';
import type { LongTermComparison } from '@/lib/marketing';
import { formatCurrency } from '@/lib/pricing/engine';

interface Props {
  config: CompanyMarketingConfig;
  comparison: LongTermComparison;
}

/**
 * "THE VALUE OF GOING PERMANENT" — three cards, all copy and numbers from
 * company_marketing_config. Every claim carries its source and disclaimer
 * inline, plus a collapsed "Research & Assumptions" footnote so the primary
 * presentation stays clean.
 */
export function ValueCards({ config, comparison }: Props) {
  const [showResearch, setShowResearch] = useState(false);
  const anyCardVisible =
    comparison.enabled || config.show_resale_stat || config.show_security_stat;

  if (!anyCardVisible) return null;

  const maxBar = Math.max(comparison.projectedAlternativeCost, comparison.lumaGlowPrice, 1);

  return (
    <section>
      <h2 className="text-center text-[13px] font-bold uppercase tracking-[0.16em] text-white/45">
        The Value of Going Permanent
      </h2>

      {/* iPad portrait (~768px, Tailwind md) stays single-column for readable
          card text; landscape (~1024px, lg) opens to the full 3-across layout. */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {comparison.enabled ? (
          <ValueCard eyebrow="Long-Term Value" title="Buy it once. Enjoy it for years.">
            <div className="space-y-3">
              <Bar
                label={`${comparison.alternativeName} × ${comparison.numberOfInstallations}`}
                value={comparison.projectedAlternativeCost}
                max={maxBar}
                tone="muted"
              />
              <Bar label="LumaGlow — Installed Once" value={comparison.lumaGlowPrice} max={maxBar} tone="accent" />
            </div>
            <p className="mt-4 text-[13px] text-white/55">
              {comparison.lumaGlowProjectsCheaper ? 'Potential projected difference' : 'Projected cost difference'}
            </p>
            <p
              className={`text-2xl font-bold tracking-tight ${
                comparison.lumaGlowProjectsCheaper ? 'text-ok' : 'text-white'
              }`}
            >
              {formatCurrency(Math.abs(comparison.difference))}
            </p>
            <p className="mt-3 text-[11px] leading-relaxed text-white/35">{comparison.disclaimer}</p>
          </ValueCard>
        ) : null}

        {config.show_resale_stat ? (
          <ValueCard eyebrow="Resale Appeal" title="Curb appeal that can pay you back.">
            <p className="text-4xl font-bold tracking-tight text-luma-gradient">{config.resale_headline}</p>
            <p className="mt-1 text-[13px] font-semibold text-white/70">{config.resale_label}</p>
            <p className="mt-3 text-[13px] leading-relaxed text-white/55">{config.resale_body}</p>

            {config.show_secondary_resale_stat ? (
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-2xl font-bold text-white">{config.secondary_resale_headline}</p>
                <p className="mt-0.5 text-[12px] font-semibold text-white/60">{config.secondary_resale_label}</p>
                <p className="mt-2 text-[12px] leading-relaxed text-white/45">{config.secondary_resale_body}</p>
              </div>
            ) : null}

            <p className="mt-3 text-[11px] leading-relaxed text-white/35">{config.resale_disclaimer}</p>
          </ValueCard>
        ) : null}

        {config.show_security_stat ? (
          <ValueCard eyebrow="Security / Visibility" title="More visibility. Less opportunity.">
            <p className="text-4xl font-bold tracking-tight text-luma-gradient">{config.security_headline}</p>
            <p className="mt-3 text-[13px] leading-relaxed text-white/55">{config.security_body}</p>
            <p className="mt-2 text-[13px] font-semibold text-white/70">{config.security_secondary_line}</p>
            <p className="mt-3 text-[11px] leading-relaxed text-white/35">{config.security_disclaimer}</p>
          </ValueCard>
        ) : null}
      </div>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => setShowResearch((v) => !v)}
          className="text-[12px] font-semibold text-white/45 underline-offset-4 hover:underline"
        >
          {showResearch ? 'Hide' : 'View'} research &amp; assumptions
        </button>
        {showResearch ? (
          <div className="mx-auto mt-3 max-w-2xl space-y-2 rounded-2xl border border-white/10 bg-white/4 p-4 text-left text-[11px] leading-relaxed text-white/45">
            {comparison.enabled ? (
              <p>
                Long-term comparison assumes {config.alternative_name} at{' '}
                {formatCurrency(comparison.alternativeInstalledCost)} replaced every{' '}
                {comparison.replacementIntervalYears} years over a {comparison.horizonYears}-year horizon.{' '}
                {comparison.disclaimer}
              </p>
            ) : null}
            {config.show_resale_stat ? (
              <p>
                Resale: {config.resale_source} {config.resale_disclaimer}
              </p>
            ) : null}
            {config.show_secondary_resale_stat ? (
              <p>
                {config.secondary_resale_source} {config.secondary_resale_disclaimer}
              </p>
            ) : null}
            {config.show_security_stat ? (
              <p>
                Security: {config.security_source} {config.security_disclaimer}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ValueCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/4 p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent-soft">{eyebrow}</p>
      <p className="mt-1.5 text-[17px] font-semibold leading-snug tracking-tight text-white">{title}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Bar({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: 'muted' | 'accent';
}) {
  const pct = Math.max(4, Math.round((value / max) * 100));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-[12px] font-semibold text-white/60">{label}</span>
        <span className="shrink-0 text-[13px] font-bold text-white">{formatCurrency(value)}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/8">
        <div
          className={`h-full rounded-full ${tone === 'accent' ? 'bg-luma-gradient' : 'bg-white/25'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
