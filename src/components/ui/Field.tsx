'use client';

import type { ComponentProps, ReactNode } from 'react';

const control =
  'w-full min-h-13 rounded-2xl border border-line bg-card px-4 py-3 text-ink ' +
  'placeholder:text-muted/60 shadow-sm transition-colors ' +
  'focus:border-[var(--brand-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]/25';

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <span className="mb-1.5 flex items-baseline justify-between">
      <span className="text-[13px] font-semibold uppercase tracking-wide text-muted">{children}</span>
      {hint ? <span className="text-[12px] text-muted">{hint}</span> : null}
    </span>
  );
}

export function TextField({
  label,
  hint,
  error,
  className = '',
  ...rest
}: { label?: string; hint?: string; error?: string | null } & ComponentProps<'input'>) {
  return (
    <label className={`block ${className}`}>
      {label ? <Label hint={hint}>{label}</Label> : null}
      <input className={`${control} ${error ? 'border-danger' : ''}`} {...rest} />
      {error ? <span className="mt-1 block text-[13px] font-medium text-danger">{error}</span> : null}
    </label>
  );
}

export function SelectField({
  label,
  hint,
  className = '',
  children,
  ...rest
}: { label?: string; hint?: string } & ComponentProps<'select'>) {
  return (
    <label className={`block ${className}`}>
      {label ? <Label hint={hint}>{label}</Label> : null}
      <select className={`${control} appearance-none pr-10`} {...rest}>
        {children}
      </select>
    </label>
  );
}

export function TextArea({
  label,
  className = '',
  ...rest
}: { label?: string } & ComponentProps<'textarea'>) {
  return (
    <label className={`block ${className}`}>
      {label ? <Label>{label}</Label> : null}
      <textarea className={`${control} min-h-28`} {...rest} />
    </label>
  );
}
