'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { DesignStatus } from '@/lib/types/db';
import { Button } from '@/components/ui/Button';
import { ProgressSteps } from '@/components/ProgressSteps';

const POLL_MS = 3000;
/** After this long we stop spinning and offer a retry rather than hang. */
const TIMEOUT_MS = 180_000;

const STEPS = [
  'Reading the roofline',
  'Mapping the elevation',
  'Placing the light run',
  'Rendering the evening scene',
  'Finishing the image',
];

interface Props {
  quoteId: string;
  designId: string;
  previewUrl: string | null;
  initialStatus: DesignStatus;
  initialError: string | null;
}

export function GeneratingScreen({ quoteId, designId, previewUrl, initialStatus, initialError }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<DesignStatus>(initialStatus);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const [step, setStep] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const settledRef = useRef(false);

  const finish = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    router.replace(`/quotes/${quoteId}/visualization`);
    router.refresh();
  }, [quoteId, router]);

  // Realtime is the fast path; polling covers dropped sockets on hotel Wi-Fi.
  useEffect(() => {
    if (status === 'failed') return;

    const supabase = createClient();

    const apply = (row: { status: DesignStatus; rendered_image_url: string | null; error_message: string | null }) => {
      if (row.status === 'complete' && row.rendered_image_url) {
        finish();
      } else if (row.status === 'failed') {
        setStatus('failed');
        setErrorMessage(row.error_message ?? 'The visualization could not be generated.');
      } else {
        setStatus(row.status);
      }
    };

    const channel = supabase
      .channel(`designs:${quoteId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'designs', filter: `quote_id=eq.${quoteId}` },
        (payload) => apply(payload.new as Parameters<typeof apply>[0]),
      )
      .subscribe();

    const poll = setInterval(async () => {
      const { data } = await supabase
        .from('designs')
        .select('status, rendered_image_url, error_message')
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: false })
        .limit(1);

      const row = data?.[0];
      if (row) apply(row as Parameters<typeof apply>[0]);
    }, POLL_MS);

    return () => {
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [finish, quoteId, status]);

  // Cycle the reassuring copy while the render runs.
  useEffect(() => {
    if (status === 'failed') return;
    const timer = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 4200);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (status === 'failed') return;
    const timer = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const retry = useCallback(async () => {
    setRetrying(true);
    setErrorMessage(null);
    setTimedOut(false);
    setStatus('processing');

    const response = await fetch('/api/generate-visualization', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ design_id: designId, quote_id: quoteId }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setStatus('failed');
      setErrorMessage(body.error ?? 'Could not restart the visualization.');
    }
    setRetrying(false);
  }, [designId, quoteId]);

  const failed = status === 'failed' || timedOut;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-ink">
      {previewUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25 blur-[2px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/85 to-ink" />
        </>
      ) : null}

      <header className="relative z-10 px-4 pt-safe">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between py-2">
            <Link
              href={`/quotes/${quoteId}/design`}
              className="-ml-2 flex h-11 items-center px-2 text-[15px] font-semibold text-white/60"
            >
              ‹ Design
            </Link>
            <span className="w-14" />
          </div>
          <ProgressSteps current="preview" tone="dark" />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-8 text-center">
        {failed ? (
          <div className="rise max-w-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-danger/15 ring-1 ring-danger/40">
              <span className="text-2xl">!</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {timedOut && status !== 'failed' ? 'This is taking longer than usual' : 'We could not render that one'}
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-white/55">
              {errorMessage ?? 'The workflow is still working or did not respond. You can try again.'}
            </p>
            <div className="mt-7 space-y-3">
              <Button variant="accent" size="xl" fullWidth onClick={retry} disabled={retrying}>
                {retrying ? 'Restarting…' : 'TRY AGAIN'}
              </Button>
              <Button
                variant="dark"
                size="lg"
                fullWidth
                onClick={() => router.push(`/quotes/${quoteId}/design`)}
              >
                Back to the design
              </Button>
            </div>
          </div>
        ) : (
          <div className="rise">
            <span className="relative mx-auto mb-8 flex h-24 w-24 items-center justify-center">
              <span className="pulse-ring absolute inset-0 rounded-full bg-accent/30" />
              <span
                className="pulse-ring absolute inset-0 rounded-full bg-accent/20"
                style={{ animationDelay: '0.7s' }}
              />
              <span className="relative h-16 w-16 rounded-full bg-gradient-to-br from-accent-soft to-accent shadow-[0_0_60px_rgba(200,162,74,0.55)]" />
            </span>

            <h1 className="text-[26px] font-semibold tracking-tight text-white">
              Designing the home
            </h1>
            <p key={step} className="rise mt-3 text-[15px] text-white/55">
              {STEPS[step]}…
            </p>

            <div className="mx-auto mt-8 h-1 w-56 overflow-hidden rounded-full bg-white/10">
              <div className="shimmer h-full w-full" />
            </div>

            <p className="mt-8 text-[13px] text-white/35">This usually takes under a minute.</p>
          </div>
        )}
      </main>
    </div>
  );
}
