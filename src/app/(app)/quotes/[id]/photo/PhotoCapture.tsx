'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { compressImage, storagePath } from '@/lib/images';
import { ProgressSteps } from '@/components/ProgressSteps';
import { Button } from '@/components/ui/Button';

const BUCKET = 'property-photos';

interface Props {
  quoteId: string;
  companyId: string;
  propertyId: string;
  designId: string | null;
  existingUrl: string | null;
  addressLine: string;
}

export function PhotoCapture({
  quoteId,
  companyId,
  propertyId,
  designId,
  existingUrl,
  addressLine,
}: Props) {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(existingUrl);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Object URLs from the picker have to be released or iOS leaks memory.
  useEffect(() => {
    return () => {
      if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const onPick = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (!picked) return;
    setError(null);
    setFile(picked);
    setPreview((old) => {
      if (old?.startsWith('blob:')) URL.revokeObjectURL(old);
      return URL.createObjectURL(picked);
    });
  }, []);

  const onUse = useCallback(async () => {
    // Photo unchanged from a previous visit — just move on.
    if (!file && existingUrl) {
      router.push(`/quotes/${quoteId}/design`);
      return;
    }
    if (!file) return;

    setBusy(true);
    setError(null);

    try {
      const supabase = createClient();
      const blob = await compressImage(file);
      const path = storagePath(companyId, quoteId, 'original');

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false });

      if (uploadError) throw new Error(uploadError.message);

      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(path);

      // One base design row per quote holds the photo, the tracing and the style.
      if (designId) {
        const { error: updateError } = await supabase
          .from('designs')
          .update({
            original_image_path: path,
            original_image_url: publicUrl,
            marked_image_path: null,
            marked_image_url: null,
            rendered_image_path: null,
            rendered_image_url: null,
            roofline_coordinates: [],
            status: 'pending',
            error_message: null,
          })
          .eq('id', designId);
        if (updateError) throw new Error(updateError.message);
      } else {
        const { error: insertError } = await supabase.from('designs').insert({
          company_id: companyId,
          quote_id: quoteId,
          property_id: propertyId,
          original_image_path: path,
          original_image_url: publicUrl,
          status: 'pending',
        });
        if (insertError) throw new Error(insertError.message);
      }

      router.push(`/quotes/${quoteId}/design`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Try again.');
      setBusy(false);
    }
  }, [companyId, designId, existingUrl, file, propertyId, quoteId, router]);

  return (
    <div className="fixed inset-0 flex flex-col bg-ink">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={onPick}
      />
      <input ref={libraryRef} type="file" accept="image/*" className="sr-only" onChange={onPick} />

      <header className="relative z-20 px-4 pt-safe">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between py-2">
            <Link href={`/quotes/${quoteId}`} className="-ml-2 flex h-11 items-center px-2 text-[15px] font-semibold text-white/70">
              ‹ Back
            </Link>
            <span className="truncate px-2 text-[13px] font-semibold text-white/70">{addressLine}</span>
            <span className="w-14" />
          </div>
          <ProgressSteps current="photo" tone="dark" />
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden">
        {preview ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={preview} alt="Property" className="absolute inset-0 h-full w-full object-contain" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            <span className="relative mb-6 flex h-20 w-20 items-center justify-center">
              <span className="pulse-ring absolute inset-0 rounded-full bg-accent/25" />
              <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white/8 ring-1 ring-white/15">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#C8A24A" strokeWidth="1.6">
                  <path d="M3 8a2 2 0 0 1 2-2h2l1.2-2h7.6L17 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                  <circle cx="12" cy="12.5" r="3.5" />
                </svg>
              </span>
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Photograph the home</h1>
            <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-white/55">
              Stand back far enough to capture the full front elevation and roofline.
            </p>
          </div>
        )}
      </div>

      <div className="relative z-20 space-y-3 bg-gradient-to-t from-black/70 to-transparent px-4 pt-8 pb-safe">
        <div className="mx-auto max-w-3xl space-y-3">
          {error ? (
            <p role="alert" className="rounded-2xl bg-danger/20 px-4 py-3 text-sm font-medium text-red-200">
              {error}
            </p>
          ) : null}

          {preview ? (
            <>
              <Button variant="accent" size="xl" fullWidth onClick={onUse} disabled={busy}>
                {busy ? 'Uploading…' : 'USE THIS PHOTO'}
              </Button>
              <Button
                variant="dark"
                size="lg"
                fullWidth
                onClick={() => cameraRef.current?.click()}
                disabled={busy}
              >
                Retake
              </Button>
            </>
          ) : (
            <>
              <Button variant="accent" size="xl" fullWidth onClick={() => cameraRef.current?.click()}>
                TAKE PHOTO
              </Button>
              <Button variant="dark" size="lg" fullWidth onClick={() => libraryRef.current?.click()}>
                Choose from library
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
