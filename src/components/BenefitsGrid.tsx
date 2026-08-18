import type { BenefitCard } from '@/lib/types/db';

/** "WHY LUMAGLOW" — capped at 6 so the homeowner never sees a wall of copy. */
export function BenefitsGrid({ benefits, tone = 'dark' }: { benefits: BenefitCard[]; tone?: 'dark' | 'light' }) {
  const items = benefits.slice(0, 6);
  if (items.length === 0) return null;

  const dark = tone === 'dark';

  return (
    <section>
      <h2
        className={`text-center text-[13px] font-bold uppercase tracking-[0.16em] ${
          dark ? 'text-white/45' : 'text-muted'
        }`}
      >
        Why LumaGlow
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((benefit) => (
          <div
            key={benefit.title}
            className={
              dark
                ? 'rounded-2xl border border-white/10 bg-white/4 p-4'
                : 'rounded-2xl border border-line bg-card p-4'
            }
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold ${
                dark ? 'bg-luma-gradient text-white' : 'bg-[var(--brand-primary)] text-white'
              }`}
              aria-hidden
            >
              ✦
            </span>
            <p className={`mt-2.5 text-[14px] font-semibold ${dark ? 'text-white' : 'text-ink'}`}>
              {benefit.title}
            </p>
            <p className={`mt-1 text-[12px] leading-relaxed ${dark ? 'text-white/55' : 'text-muted'}`}>
              {benefit.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
