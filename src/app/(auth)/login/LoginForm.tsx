'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginAction, type AuthState } from '../actions';
import { Button } from '@/components/ui/Button';
import { AuthInput } from '../AuthInput';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" size="xl" fullWidth disabled={pending}>
      {pending ? 'Signing in…' : 'SIGN IN'}
    </Button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<AuthState, FormData>(loginAction, {});

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next ?? ''} />
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
        placeholder="Password"
        autoComplete="current-password"
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
