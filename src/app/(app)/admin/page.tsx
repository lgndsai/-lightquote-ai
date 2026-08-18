import Link from 'next/link';

export const metadata = { title: 'Admin — LightQuote AI' };

const SECTIONS = [
  { href: '/admin/company', title: 'Company', body: 'Name, logo, brand colors, contact details, warranty and proposal benefits.' },
  { href: '/admin/pricing', title: 'Pricing', body: 'Price per foot, minimums, tax, dealer fees and the three proposal levels.' },
  { href: '/admin/catalog', title: 'Catalog', body: 'Controllers, track colors, adders and discounts offered on every quote.' },
  { href: '/admin/finance', title: 'Finance programs', body: 'Terms, APR or payment factor, dealer fee and minimum amount.' },
  { href: '/admin/users', title: 'Users', body: 'Invite teammates and set admin, manager or sales rep access.' },
];

export default function AdminHome() {
  return (
    <main className="mx-auto max-w-3xl space-y-3 px-4 pt-5 pb-16">
      <h1 className="mb-2 text-[26px] font-semibold tracking-tight text-ink">Admin settings</h1>
      {SECTIONS.map((section) => (
        <Link
          key={section.href}
          href={section.href}
          className="flex items-center justify-between gap-4 rounded-3xl border border-line bg-card p-5 shadow-sm active:scale-[0.99]"
        >
          <span className="min-w-0">
            <span className="block text-[17px] font-semibold text-ink">{section.title}</span>
            <span className="mt-1 block text-[13px] leading-snug text-muted">{section.body}</span>
          </span>
          <span aria-hidden className="shrink-0 text-muted">›</span>
        </Link>
      ))}
    </main>
  );
}
