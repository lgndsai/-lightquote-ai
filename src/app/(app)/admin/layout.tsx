import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { AppHeader } from '@/components/AppHeader';

const NAV = [
  { href: '/admin/company', label: 'Company' },
  { href: '/admin/pricing', label: 'Pricing' },
  { href: '/admin/catalog', label: 'Catalog' },
  { href: '/admin/finance', label: 'Finance' },
  { href: '/admin/marketing', label: 'Marketing' },
  { href: '/admin/users', label: 'Users' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('admin');

  return (
    <>
      <AppHeader session={session} />
      <div className="mx-auto max-w-3xl px-4 pt-4">
        <nav className="-mx-4 px-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Link
              href="/admin"
              className="shrink-0 rounded-full border border-line bg-card px-4 py-2.5 text-sm font-semibold text-muted"
            >
              Overview
            </Link>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-full border border-line bg-card px-4 py-2.5 text-sm font-semibold text-muted"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>
      {children}
    </>
  );
}
