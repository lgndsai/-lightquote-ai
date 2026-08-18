'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProposal } from '../actions';
import { Button } from '@/components/ui/Button';

export function NextStepCta({ quoteId, financing }: { quoteId: string; financing: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = useCallback(async () => {
    setPending(true);
    setError(null);

    const result = await createProposal(quoteId);
    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }

    router.push(`/quotes/${quoteId}/proposal`);
  }, [quoteId, router]);

  return (
    <div className="space-y-2">
      {error ? (
        <p role="alert" className="rounded-2xl bg-danger/20 px-4 py-3 text-sm font-medium text-red-200">
          {error}
        </p>
      ) : null}
      <Button variant="accent" size="xl" fullWidth onClick={go} disabled={pending}>
        {pending ? 'Preparing…' : financing ? 'CONTINUE WITH FINANCING' : 'ACCEPT DESIGN & CONTINUE'}
      </Button>
    </div>
  );
}
