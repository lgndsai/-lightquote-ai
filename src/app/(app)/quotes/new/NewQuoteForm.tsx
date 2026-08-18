'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createQuoteAction, type NewQuoteState } from './actions';
import { TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-paper via-paper/95 to-transparent px-4 pt-8 pb-safe">
      <div className="pointer-events-auto mx-auto max-w-2xl">
        <Button type="submit" variant="primary" size="xl" fullWidth disabled={pending}>
          {pending ? 'Starting…' : 'CONTINUE'}
        </Button>
      </div>
    </div>
  );
}

export function NewQuoteForm() {
  const [state, action] = useActionState<NewQuoteState, FormData>(createQuoteAction, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="mt-6 space-y-6">
      <fieldset className="space-y-3">
        <legend className="mb-2 text-[13px] font-bold uppercase tracking-[0.12em] text-muted">
          Customer
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            name="first_name"
            label="First name"
            autoComplete="given-name"
            autoCapitalize="words"
            enterKeyHint="next"
            error={fe.first_name}
            required
          />
          <TextField
            name="last_name"
            label="Last name"
            autoComplete="family-name"
            autoCapitalize="words"
            enterKeyHint="next"
            error={fe.last_name}
            required
          />
        </div>
        <TextField
          name="phone"
          label="Phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          enterKeyHint="next"
          error={fe.phone}
        />
        <TextField
          name="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          enterKeyHint="next"
          error={fe.email}
        />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-[13px] font-bold uppercase tracking-[0.12em] text-muted">
          Property
        </legend>
        <TextField
          name="address_line1"
          label="Street address"
          autoComplete="address-line1"
          autoCapitalize="words"
          enterKeyHint="next"
          error={fe.address_line1}
          required
        />
        <TextField
          name="city"
          label="City"
          autoComplete="address-level2"
          autoCapitalize="words"
          enterKeyHint="next"
          error={fe.city}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            name="state"
            label="State"
            autoComplete="address-level1"
            autoCapitalize="characters"
            maxLength={2}
            enterKeyHint="next"
            error={fe.state}
            required
          />
          <TextField
            name="zip"
            label="ZIP"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={10}
            enterKeyHint="done"
            error={fe.zip}
            required
          />
        </div>
      </fieldset>

      {state.error ? (
        <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          {state.error}
        </p>
      ) : null}

      <Submit />
    </form>
  );
}
