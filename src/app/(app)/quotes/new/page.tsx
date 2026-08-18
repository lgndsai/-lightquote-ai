import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { ProgressSteps } from '@/components/ProgressSteps';
import { NewQuoteForm } from './NewQuoteForm';

export const metadata = { title: 'New quote — LumaGlow' };

export default async function NewQuotePage() {
  await requireSession();

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 pt-safe backdrop-blur-xl">
        <div className="mx-auto max-w-2xl px-4 pb-3">
          <div className="mb-3 flex items-center justify-between">
            <Link href="/dashboard" className="-ml-2 flex h-11 items-center px-2 text-[15px] font-semibold text-muted">
              ‹ Cancel
            </Link>
            <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-muted">
              New Quote
            </span>
            <span className="w-16" />
          </div>
          <ProgressSteps current="customer" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-6 pb-40">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-ink">
          Who are we quoting?
        </h1>
        <p className="mt-1.5 text-[15px] text-muted">
          Name and address only. Everything else comes from the photo.
        </p>

        <NewQuoteForm />
      </main>
    </>
  );
}
