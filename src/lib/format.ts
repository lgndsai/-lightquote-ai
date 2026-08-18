import type { ProjectStatus, QuoteStatus } from '@/lib/types/db';

export function formatDate(value: string | null | undefined) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShortDate(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function formatPhone(value: string | null | undefined) {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value;
}

export function customerName(c: { first_name?: string | null; last_name?: string | null } | null) {
  if (!c) return 'Unnamed customer';
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unnamed customer';
}

export function addressLine(
  p: { address_line1?: string | null; city?: string | null; state?: string | null; zip?: string | null } | null,
) {
  if (!p) return '';
  const tail = [p.city, p.state].filter(Boolean).join(', ');
  return [p.address_line1, [tail, p.zip].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
}

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: 'In progress',
  pending: 'Pending',
  sold: 'Sold',
  lost: 'Lost',
};

export const QUOTE_STATUS_STYLE: Record<QuoteStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  pending: 'bg-amber-100 text-amber-700',
  sold: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-rose-100 text-rose-700',
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  sold: 'Sold',
  scheduled: 'Scheduled',
  installed: 'Installed',
  cancelled: 'Cancelled',
};

export const PROJECT_STATUS_STYLE: Record<ProjectStatus, string> = {
  sold: 'bg-emerald-100 text-emerald-700',
  scheduled: 'bg-blue-100 text-blue-700',
  installed: 'bg-indigo-100 text-indigo-700',
  cancelled: 'bg-rose-100 text-rose-700',
};

/**
 * All quote cards route through /quotes/[id], which inspects the quote's
 * real state server-side and forwards to the right step.
 */
export function quoteResumeHref(quote: { id: string }) {
  return `/quotes/${quote.id}`;
}
