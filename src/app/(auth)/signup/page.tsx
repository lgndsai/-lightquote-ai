import Link from 'next/link';
import { SignupForm } from './SignupForm';

export const metadata = { title: 'Create account — LightQuote AI' };

export default function SignupPage() {
  return (
    <div className="rise py-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Create your company</h1>
        <p className="mt-2 text-sm text-muted-dark">
          You will be the admin and can invite your reps next.
        </p>
      </div>

      <SignupForm />

      <p className="mt-8 text-center text-sm text-muted-dark">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-accent-soft underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
