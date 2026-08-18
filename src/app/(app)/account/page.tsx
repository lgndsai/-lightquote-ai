import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { AppHeader } from '@/components/AppHeader';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const ROLE_LABEL = { admin: 'Administrator', manager: 'Manager', sales_rep: 'Sales Representative' };

export default async function AccountPage() {
  const session = await requireSession();
  const { user, company } = session;

  return (
    <>
      <AppHeader session={session} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 pt-5 pb-16">
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">Account</h1>

        <Card className="space-y-3">
          <Row label="Name" value={user.full_name ?? '—'} />
          <Row label="Email" value={user.email} />
          <Row label="Role" value={ROLE_LABEL[user.role]} />
          <Row label="Company" value={company.name} />
        </Card>

        {user.role === 'admin' ? (
          <div>
            <SectionTitle>Company</SectionTitle>
            <Link
              href="/admin"
              className="flex min-h-14 items-center justify-between rounded-2xl border border-line bg-card px-5 font-semibold text-ink shadow-sm"
            >
              Admin settings
              <span aria-hidden className="text-muted">›</span>
            </Link>
          </div>
        ) : null}

        <form action="/auth/signout" method="post">
          <Button type="submit" variant="secondary" size="lg" fullWidth className="text-danger">
            Sign out
          </Button>
        </form>
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3 last:border-0 last:pb-0">
      <span className="text-[13px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <span className="text-right text-[15px] font-medium text-ink">{value}</span>
    </div>
  );
}
