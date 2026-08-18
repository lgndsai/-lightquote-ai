'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { signedUrl } from '@/lib/storage';
import { VISUALIZATION_PRESETS, type DesignStatus } from '@/lib/types/db';
import { BeforeAfterSlider } from '@/components/BeforeAfterSlider';
import { ProgressSteps } from '@/components/ProgressSteps';
import { Button } from '@/components/ui/Button';

const RENDER_BUCKET = 'renders';

interface DesignSummary {
  id: string;
  preset: string | null;
  lighting_style: string;
  status: DesignStatus;
  rendered_image_path: string | null;
  /** Pre-signed by the server for the initial load only; never trusted after that. */
  rendered_image_url?: string | null;
}

interface Props {
  quoteId: string;
  baseDesignId: string;
  originalUrl: string;
  selectedDesignId: string;
  designs: DesignSummary[];
}

export function VisualizationResult({
  quoteId,
  baseDesignId,
  originalUrl,
  selectedDesignId,
  designs: initialDesigns,
}: Props) {
  const router = useRouter();
  const [designs, setDesigns] = useState(initialDesigns);
  const [activeId, setActiveId] = useState(selectedDesignId);
  const [busyPreset, setBusyPreset] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);

  // renders is a private bucket — a signed URL is minted client-side (RLS on
  // storage.objects still scopes it to this company) the moment a path
  // becomes available, and cached here rather than re-signed on every render.
  const [urls, setUrls] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const d of initialDesigns) {
      if (d.rendered_image_url) seed[d.id] = d.rendered_image_url;
    }
    return seed;
  });

  useEffect(() => {
    const missing = designs.filter(
      (d) => d.status === 'complete' && d.rendered_image_path && !urls[d.id],
    );
    if (missing.length === 0) return;

    const supabase = createClient();
    let cancelled = false;

    void Promise.all(
      missing.map(async (d) => {
        const url = await signedUrl(supabase, RENDER_BUCKET, d.rendered_image_path);
        return [d.id, url] as const;
      }),
    ).then((pairs) => {
      if (cancelled) return;
      setUrls((current) => {
        const next = { ...current };
        for (const [id, url] of pairs) if (url) next[id] = url;
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [designs, urls]);

  const active = useMemo(() => {
    const byId = designs.find((d) => d.id === activeId && urls[d.id]);
    if (byId) return { design: byId, url: urls[byId.id] };
    const anyRendered = designs.find((d) => urls[d.id]);
    return anyRendered ? { design: anyRendered, url: urls[anyRendered.id] } : null;
  }, [activeId, designs, urls]);

  /** The design row backing a given preset chip, if one exists. */
  const designForPreset = useCallback(
    (preset: string) =>
      designs.find((d) => d.preset === preset) ??
      (preset === 'warm_white'
        ? designs.find((d) => !d.preset && d.lighting_style === 'warm_white')
        : undefined),
    [designs],
  );

  const hasPending = designs.some((d) => d.status === 'pending' || d.status === 'processing');

  // Keep preset chips live while their renders finish. Depending on the
  // boolean rather than the array stops the channel from being torn down and
  // rebuilt on every poll tick.
  useEffect(() => {
    if (!hasPending) return;

    const supabase = createClient();

    const apply = (row: DesignSummary) =>
      setDesigns((current) => {
        const exists = current.some((d) => d.id === row.id);
        return exists ? current.map((d) => (d.id === row.id ? { ...d, ...row } : d)) : [...current, row];
      });

    const channel = supabase
      .channel(`viz:${quoteId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'designs', filter: `quote_id=eq.${quoteId}` },
        (payload) => apply(payload.new as DesignSummary),
      )
      .subscribe();

    const poll = setInterval(async () => {
      const { data } = await supabase
        .from('designs')
        .select('id, preset, lighting_style, status, rendered_image_path')
        .eq('quote_id', quoteId);
      if (data) setDesigns(data as DesignSummary[]);
    }, 3500);

    return () => {
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [hasPending, quoteId]);

  const choosePreset = useCallback(
    async (preset: string) => {
      const existing = designForPreset(preset);

      if (existing?.status === 'complete' && existing.rendered_image_path) {
        setActiveId(existing.id);
        return;
      }
      if (existing?.status === 'processing' || existing?.status === 'pending') return;

      setBusyPreset(preset);
      setError(null);

      const response = await fetch('/api/generate-visualization', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ design_id: baseDesignId, quote_id: quoteId, preset }),
      });

      const body = await response.json().catch(() => ({}));
      setBusyPreset(null);

      if (!response.ok) {
        setError(body.error ?? 'Could not generate that look.');
        return;
      }

      setDesigns((current) => [
        ...current,
        {
          id: body.design_id,
          preset,
          lighting_style: preset,
          status: 'processing',
          rendered_image_path: null,
        },
      ]);
    },
    [baseDesignId, designForPreset, quoteId],
  );

  const buildQuote = useCallback(async () => {
    if (!active) return;
    setAdvancing(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('quotes')
      .update({ selected_design_id: active.design.id })
      .eq('id', quoteId);

    if (updateError) {
      setError(updateError.message);
      setAdvancing(false);
      return;
    }

    router.push(`/quotes/${quoteId}/measure`);
  }, [active, quoteId, router]);

  return (
    <div className="fixed inset-0 flex flex-col bg-luma-surface">
      <header className="relative z-20 shrink-0 px-4 pt-safe">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between py-2">
            <Link
              href={`/quotes/${quoteId}/design`}
              className="-ml-2 flex h-11 items-center px-2 text-[15px] font-semibold text-white/60"
            >
              ‹ Design
            </Link>
            <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-white/45">
              Your home, at night
            </span>
            <span className="w-14" />
          </div>
          <ProgressSteps current="preview" tone="dark" />
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 py-3">
        {active ? (
          <BeforeAfterSlider
            beforeUrl={originalUrl}
            afterUrl={active.url}
            className="max-h-full w-full rounded-3xl bg-black/40 ring-1 ring-white/10"
          />
        ) : (
          <div className="shimmer h-full w-full rounded-3xl" />
        )}
      </div>

      <div className="relative z-20 shrink-0 space-y-3 bg-gradient-to-t from-black/85 via-black/65 to-transparent px-4 pt-6 pb-safe">
        <div className="mx-auto max-w-4xl space-y-3">
          <p className="text-center text-[12px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Try another look
          </p>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {VISUALIZATION_PRESETS.map((preset) => {
              const design = designForPreset(preset.key);
              const isActive = design && design.id === active?.design.id;
              const isRunning =
                busyPreset === preset.key || design?.status === 'processing' || design?.status === 'pending';

              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => void choosePreset(preset.key)}
                  disabled={isRunning}
                  className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-[13px] font-semibold no-select transition-colors disabled:opacity-70 ${
                    isActive
                      ? 'border-accent bg-accent text-ink'
                      : 'border-white/15 bg-white/8 text-white/75'
                  }`}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full ring-1 ring-white/40"
                    style={{ background: preset.swatch }}
                  />
                  {preset.label}
                  {isRunning ? <span className="text-[11px] opacity-70">rendering…</span> : null}
                </button>
              );
            })}
          </div>

          {error ? (
            <p role="alert" className="rounded-2xl bg-danger/20 px-4 py-3 text-sm font-medium text-red-200">
              {error}
            </p>
          ) : null}

          <Button variant="accent" size="xl" fullWidth onClick={buildQuote} disabled={advancing || !active}>
            {advancing ? 'Opening…' : 'BUILD MY QUOTE'}
          </Button>
        </div>
      </div>
    </div>
  );
}
