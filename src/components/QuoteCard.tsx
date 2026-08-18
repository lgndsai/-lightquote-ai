import Link from 'next/link';
import type { QuoteListItem } from '@/lib/types/db';
import { formatCurrency } from '@/lib/pricing/engine';
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_STYLE,
  QUOTE_STATUS_LABEL,
  QUOTE_STATUS_STYLE,
  addressLine,
  customerName,
  formatShortDate,
  quoteResumeHref,
} from '@/lib/format';

export function QuoteCard({ quote }: { quote: QuoteListItem }) {
  const project = quote.projects?.[0] ?? null;

  // A project status is more specific than the quote status once sold.
  const badgeLabel = project ? PROJECT_STATUS_LABEL[project.status] : QUOTE_STATUS_LABEL[quote.status];
  const badgeStyle = project ? PROJECT_STATUS_STYLE[project.status] : QUOTE_STATUS_STYLE[quote.status];

  return (
    <Link
      href={quoteResumeHref(quote)}
      className="block rounded-3xl border border-line bg-card p-4 shadow-sm transition-transform active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold leading-tight text-ink">
            {customerName(quote.customers)}
          </p>
          <p className="mt-1 truncate text-[13px] leading-snug text-muted">
            {addressLine(quote.properties) || 'No address on file'}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${badgeStyle}`}
        >
          {badgeLabel}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3 border-t border-line pt-3">
        <span className="text-2xl font-semibold tracking-tight text-ink">
          {quote.total > 0 ? formatCurrency(quote.total) : '—'}
        </span>
        <span className="text-[12px] text-muted">
          {quote.quote_number} · {formatShortDate(quote.created_at)}
        </span>
      </div>
    </Link>
  );
}
