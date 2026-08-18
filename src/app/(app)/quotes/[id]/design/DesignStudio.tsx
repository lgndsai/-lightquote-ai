'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { exportMarkedImage, storagePath } from '@/lib/images';
import { LIGHTING_STYLES, type RooflineStroke } from '@/lib/types/db';
import { ProgressSteps } from '@/components/ProgressSteps';
import { Button } from '@/components/ui/Button';
import { DesignCanvas, type Tool } from './DesignCanvas';

const BUCKET = 'property-photos';
const AUTOSAVE_MS = 900;

interface Props {
  quoteId: string;
  companyId: string;
  designId: string;
  imageUrl: string;
  initialStrokes: RooflineStroke[];
  initialStyle: string;
}

export function DesignStudio({
  quoteId,
  companyId,
  designId,
  imageUrl,
  initialStrokes,
  initialStyle,
}: Props) {
  const router = useRouter();

  const [strokes, setStrokes] = useState<RooflineStroke[]>(initialStrokes);
  const [style, setStyle] = useState(initialStyle);
  const [tool, setTool] = useState<Tool>('draw');
  const [history, setHistory] = useState<RooflineStroke[][]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    async (nextStrokes: RooflineStroke[], nextStyle: string) => {
      setSaveState('saving');
      const supabase = createClient();
      const { error: saveError } = await supabase
        .from('designs')
        .update({ roofline_coordinates: nextStrokes, lighting_style: nextStyle })
        .eq('id', designId);

      if (saveError) {
        setSaveState('error');
        return false;
      }
      dirtyRef.current = false;
      setSaveState('saved');
      return true;
    },
    [designId],
  );

  // Autosave: the rep never presses save, and a dropped connection retries on
  // the next edit rather than losing the tracing.
  useEffect(() => {
    if (!dirtyRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void persist(strokes, style), AUTOSAVE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [strokes, style, persist]);

  const commit = useCallback(
    (next: RooflineStroke[]) => {
      setHistory((h) => [...h.slice(-40), strokes]);
      dirtyRef.current = true;
      setStrokes(next);
    },
    [strokes],
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const previous = h[h.length - 1];
      dirtyRef.current = true;
      setStrokes(previous);
      return h.slice(0, -1);
    });
  }, []);

  const clear = useCallback(() => {
    if (strokes.length === 0) return;
    setHistory((h) => [...h.slice(-40), strokes]);
    dirtyRef.current = true;
    setStrokes([]);
  }, [strokes]);

  const changeStyle = useCallback((next: string) => {
    dirtyRef.current = true;
    setStyle(next);
  }, []);

  const generate = useCallback(async () => {
    if (strokes.length === 0) {
      setError('Trace the roofline first, then generate the preview.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const saved = await persist(strokes, style);
      if (!saved) throw new Error('Could not save the design. Check your connection.');

      const supabase = createClient();
      const marked = await exportMarkedImage(imageUrl, strokes, style);
      const path = storagePath(companyId, quoteId, 'marked');

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, marked, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw new Error(uploadError.message);

      // property-photos is private — only the path is stored, never a URL.
      const { error: updateError } = await supabase
        .from('designs')
        .update({ marked_image_path: path })
        .eq('id', designId);
      if (updateError) throw new Error(updateError.message);

      // The API route builds the n8n payload from the stored record rather
      // than trusting anything posted from the browser.
      const response = await fetch('/api/generate-visualization', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ design_id: designId, quote_id: quoteId }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Could not start the visualization.');
      }

      router.push(`/quotes/${quoteId}/generating`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  }, [companyId, designId, imageUrl, persist, quoteId, router, strokes, style]);

  return (
    <div className="fixed inset-0 flex flex-col bg-luma-surface">
      <header className="relative z-20 shrink-0 px-4 pt-safe">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between py-2">
            <Link
              href={`/quotes/${quoteId}/photo`}
              className="-ml-2 flex h-11 items-center px-2 text-[15px] font-semibold text-white/70"
            >
              ‹ Photo
            </Link>
            <span className="text-[12px] font-semibold text-white/45">
              {saveState === 'saving'
                ? 'Saving…'
                : saveState === 'saved'
                  ? 'Saved'
                  : saveState === 'error'
                    ? 'Save failed — retrying'
                    : ''}
            </span>
            <span className="w-14" />
          </div>
          <ProgressSteps current="design" tone="dark" />
        </div>
      </header>

      <div className="relative min-h-0 flex-1 px-2 py-2">
        <DesignCanvas
          imageUrl={imageUrl}
          style={style}
          strokes={strokes}
          tool={tool}
          onChange={setStrokes}
          onCommit={commit}
        />

        {strokes.length === 0 ? (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto max-w-xs rounded-full bg-black/55 px-4 py-2 text-center text-[13px] font-medium text-white/85 backdrop-blur">
            Trace the roofline with your finger
          </p>
        ) : null}
      </div>

      <div className="relative z-20 shrink-0 space-y-3 bg-gradient-to-t from-black/80 via-black/60 to-transparent px-4 pt-6 pb-safe">
        <div className="mx-auto max-w-4xl space-y-3">
          {/* Tools */}
          <div className="flex gap-2">
            <ToolButton active={tool === 'draw'} onClick={() => setTool('draw')} label="Draw" />
            <ToolButton active={tool === 'erase'} onClick={() => setTool('erase')} label="Erase" />
            <ToolButton onClick={undo} label="Undo" disabled={history.length === 0} />
            <ToolButton onClick={clear} label="Clear" disabled={strokes.length === 0} />
          </div>

          {/* Lighting style */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {LIGHTING_STYLES.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => changeStyle(option.key)}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-[13px] font-semibold no-select transition-colors ${
                  style === option.key
                    ? 'border-accent bg-accent/20 text-white'
                    : 'border-white/15 bg-white/8 text-white/65'
                }`}
              >
                <span
                  className="h-3.5 w-3.5 rounded-full ring-1 ring-white/40"
                  style={{ background: option.swatch }}
                />
                {option.label}
              </button>
            ))}
          </div>

          {error ? (
            <p role="alert" className="rounded-2xl bg-danger/20 px-4 py-3 text-sm font-medium text-red-200">
              {error}
            </p>
          ) : null}

          <Button variant="accent" size="xl" fullWidth onClick={generate} disabled={busy}>
            {busy ? 'Preparing…' : 'GENERATE PREVIEW'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-12 flex-1 rounded-2xl border text-[14px] font-semibold no-select transition-colors disabled:opacity-35 ${
        active
          ? 'border-accent bg-accent text-ink'
          : 'border-white/15 bg-white/8 text-white/80'
      }`}
    >
      {label}
    </button>
  );
}
