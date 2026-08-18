import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'dark';
type Size = 'md' | 'lg' | 'xl';

const base =
  'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold no-select ' +
  'transition-[transform,opacity,background-color] duration-150 active:scale-[0.98] ' +
  'disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--brand-accent)]';

const variants: Record<Variant, string> = {
  primary: 'bg-[var(--brand-primary)] text-white shadow-lg shadow-black/10',
  accent: 'bg-[var(--brand-accent)] text-ink shadow-lg shadow-black/20',
  secondary: 'bg-card text-ink border border-line shadow-sm',
  ghost: 'bg-transparent text-muted',
  danger: 'bg-danger text-white',
  dark: 'bg-white/10 text-white border border-white/20 backdrop-blur',
};

// Minimum 48px tall everywhere — these are thumb targets, not mouse targets.
const sizes: Record<Size, string> = {
  md: 'min-h-12 px-5 text-[15px]',
  lg: 'min-h-14 px-6 text-base',
  xl: 'min-h-16 px-7 text-lg tracking-wide',
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
  className?: string;
}

export function buttonClass({ variant = 'primary', size = 'lg', fullWidth, className = '' }: CommonProps & { children?: ReactNode }) {
  return [base, variants[variant], sizes[size], fullWidth ? 'w-full' : '', className]
    .filter(Boolean)
    .join(' ');
}

export function Button({
  variant,
  size,
  fullWidth,
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<'button'>) {
  return (
    <button className={buttonClass({ variant, size, fullWidth, className, children })} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  fullWidth,
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClass({ variant, size, fullWidth, className, children })} {...rest}>
      {children}
    </Link>
  );
}
