import Link from 'next/link';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Sign in — LightQuote AI' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="rise">
      <div className="mb-9 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 ring-1 ring-accent/40">
          <span className="text-2xl">✦</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">LightQuote AI</h1>
        <p className="mt-2 text-sm text-muted-dark">
          Design, visualize and sell in under five minutes.
        </p>
      </div>

      <LoginForm next={next} />

      <p className="mt-8 text-center text-sm text-muted-dark">
        New company?{' '}
        <Link href="/signup" className="font-semibold text-accent-soft underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
