import Link from 'next/link';
import type { Session } from '@/lib/auth';

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function AppHeader({ session }: { session: Session }) {
  const { user, company } = session;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 pt-safe backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 pb-3">
        <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-3">
          {company.logo_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={company.logo_url}
              alt=""
              className="h-9 w-9 shrink-0 rounded-xl object-contain"
            />
          ) : (
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ background: 'var(--brand-primary)' }}
            >
              {company.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold leading-tight text-ink">
              {company.name}
            </span>
            <span className="block truncate text-[12px] leading-tight text-muted">
              {user.full_name ?? user.email}
            </span>
          </span>
        </Link>

        {user.role === 'admin' ? (
          <Link
            href="/admin"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card text-muted"
            aria-label="Admin settings"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
          </Link>
        ) : null}

        <Link
          href="/account"
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-[13px] font-bold text-white"
          aria-label="Account"
        >
          {initials(user.full_name, user.email)}
        </Link>
      </div>
    </header>
  );
}
