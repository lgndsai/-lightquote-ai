'use client';

import { useState } from 'react';
import { BeforeAfterSlider } from '@/components/BeforeAfterSlider';

/**
 * The hero design image. When there's an actual before photo to compare
 * against, a tap reveals a drag slider — otherwise it's just the rendered
 * (or marked) design, full bleed.
 */
export function HeroToggle({ originalUrl, heroUrl }: { originalUrl: string | null; heroUrl: string }) {
  const [comparing, setComparing] = useState(false);
  const canCompare = Boolean(originalUrl && originalUrl !== heroUrl);

  return (
    <div className="relative">
      {comparing && canCompare && originalUrl ? (
        <BeforeAfterSlider beforeUrl={originalUrl} afterUrl={heroUrl} className="aspect-[4/3] w-full sm:aspect-video" />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={heroUrl} alt="Your custom LumaGlow design" className="aspect-[4/3] w-full object-cover sm:aspect-video" />
      )}

      {canCompare ? (
        <button
          type="button"
          onClick={() => setComparing((v) => !v)}
          className="absolute bottom-3 right-3 rounded-full bg-black/55 px-4 py-2 text-[12px] font-bold uppercase tracking-wide text-white backdrop-blur"
        >
          {comparing ? 'View design' : 'Before / After'}
        </button>
      ) : null}
    </div>
  );
}
