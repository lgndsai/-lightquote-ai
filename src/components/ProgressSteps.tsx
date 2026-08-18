const STEPS = [
  { key: 'customer', label: 'Customer' },
  { key: 'photo', label: 'Photo' },
  { key: 'design', label: 'Design' },
  { key: 'preview', label: 'Preview' },
  { key: 'price', label: 'Price' },
  { key: 'proposal', label: 'Proposal' },
] as const;

export type StepKey = (typeof STEPS)[number]['key'];

/** Thin, always-visible progress rail. `tone` matches the screen's mood. */
export function ProgressSteps({ current, tone = 'light' }: { current: StepKey; tone?: 'light' | 'dark' }) {
  const index = STEPS.findIndex((s) => s.key === current);
  const dark = tone === 'dark';

  return (
    <div className="flex items-center gap-1.5" aria-label={`Step ${index + 1} of ${STEPS.length}`}>
      {STEPS.map((step, i) => {
        const done = i < index;
        const active = i === index;
        return (
          <div key={step.key} className="flex flex-1 flex-col gap-1.5">
            <span
              className={`h-1 rounded-full transition-colors ${
                done || active
                  ? dark
                    ? 'bg-[var(--brand-accent)]'
                    : 'bg-[var(--brand-primary)]'
                  : dark
                    ? 'bg-white/20'
                    : 'bg-line'
              }`}
            />
            <span
              className={`hidden text-[10px] font-bold uppercase tracking-wide sm:block ${
                active ? (dark ? 'text-white' : 'text-ink') : dark ? 'text-white/40' : 'text-muted'
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
