'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Premium before/after comparison. The handle tracks the pointer directly
 * (no drag threshold) because customers reach out and grab it mid-swipe.
 */
export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  className = '',
}: {
  beforeUrl: string;
  afterUrl: string;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(55);
  const [dragging, setDragging] = useState(false);

  const move = useCallback((clientX: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    if (rect.width === 0) return;
    setPosition(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  return (
    <div
      ref={frameRef}
      className={`relative select-none overflow-hidden ${className}`}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        move(event.clientX);
      }}
      onPointerMove={(event) => {
        if (dragging) move(event.clientX);
      }}
      onPointerUp={(event) => {
        setDragging(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => setDragging(false)}
      style={{ touchAction: 'none' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={afterUrl} alt="With lighting" className="h-full w-full object-contain" draggable={false} />

      <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl}
          alt="Before"
          className="h-full w-full object-contain"
          draggable={false}
          style={{ width: frameRef.current?.clientWidth ? `${frameRef.current.clientWidth}px` : '100%', maxWidth: 'none' }}
        />
      </div>

      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/90 backdrop-blur">
        Before
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-[var(--brand-accent)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-ink">
        After
      </span>

      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90 shadow-[0_0_20px_rgba(0,0,0,0.5)]"
        style={{ left: `${position}%` }}
      >
        <span className="absolute top-1/2 left-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-xl">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="m9 6-5 6 5 6M15 6l5 6-5 6" />
          </svg>
        </span>
      </div>
    </div>
  );
}
