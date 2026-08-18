'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';

export function SubmitButton({ label = 'Save', pendingLabel = 'Saving…' }: { label?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" fullWidth disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function FormMessage({ error, message }: { error?: string; message?: string }) {
  if (error) {
    return (
      <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
        {error}
      </p>
    );
  }
  if (message) {
    return (
      <p role="status" className="rounded-2xl bg-ok/10 px-4 py-3 text-sm font-medium text-ok">
        {message}
      </p>
    );
  }
  return null;
}
