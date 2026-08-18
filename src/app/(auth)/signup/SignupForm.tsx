'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { signupAction, type AuthState } from '../actions';
import { Button } from '@/components/ui/Button';
import { AuthInput } from '../AuthInput';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" size="xl" fullWidth disabled={pending}>
      {pending ? 'Creating…' : 'CREATE ACCOUNT'}
    </Button>
  );
}

export function SignupForm() {
  const [state, action] = useActionState<AuthState, FormData>(signupAction, {});

  return (
    <form action={action} className="space-y-3">
      <AuthInput name="full_name" placeholder="Your name" autoComplete="name" required />
      <AuthInput name="company_name" placeholder="Company name" autoComplete="organization" required />
      <AuthInput
        name="email"
        type="email"
        placeholder="Email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        required
      />
      <AuthInput
        name="password"
        type="password"
        placeholder="Password (8+ characters)"
        autoComplete="new-password"
        minLength={8}
        required
      />
      {state.error ? (
        <p role="alert" className="rounded-xl bg-danger/15 px-4 py-3 text-sm font-medium text-red-200">
          {state.error}
        </p>
      ) : null}
      <div className="pt-2">
        <Submit />
      </div>
    </form>
  );
}
