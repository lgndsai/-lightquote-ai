'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RooflinePoint, RooflineStroke } from '@/lib/types/db';
import { drawStrokes, eraseAt } from '@/lib/canvas';

const MIN_POINT_DELTA = 0.004;
const ERASER_RADIUS = 0.03;
const STROKE_WIDTH = 0.006;

export type Tool = 'draw' | 'erase';

interface Props {
  imageUrl: string;
  style: string;
  strokes: RooflineStroke[];
  tool: Tool;
  onChange: (strokes: RooflineStroke[]) => void;
  onCommit: (strokes: RooflineStroke[]) => void;
}

/**
 * Photo + tracing surface. The canvas is laid over an object-contain image
 * inside a wrapper locked to the photo's aspect ratio, so canvas pixels and
 * photo pixels always line up regardless of device.
 */
export function DesignCanvas({ imageUrl, style, strokes, tool, onChange, onCommit }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const activeRef = useRef<RooflineStroke | null>(null);
  const strokesRef = useRef(strokes);

  const [aspect, setAspect] = useState<number | null>(null);
  const [imageReady, setImageReady] = useState(false);

  // Pointer handlers read the latest strokes through a ref; this effect is
  // declared first so the ref is current before the repaint effect runs.
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  // Repaint on any change to strokes, style or layout.
  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const live = activeRef.current
      ? [...strokesRef.current, activeRef.current]
      : strokesRef.current;

    drawStrokes(ctx, live, rect.width, rect.height, style);
  }, [style]);

  useEffect(() => {
    repaint();
  }, [repaint, strokes, aspect]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(() => repaint());
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [repaint]);

  const pointFrom = useCallback((event: React.PointerEvent): RooflinePoint | null => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return null;
    const rect = wrapper.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: clamp01((event.clientX - rect.left) / rect.width),
      y: clamp01((event.clientY - rect.top) / rect.height),
    };
  }, []);

  const handleDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const point = pointFrom(event);
      if (!point) return;

      event.currentTarget.setPointerCapture(event.pointerId);
      drawingRef.current = true;

      if (tool === 'erase') {
        onChange(eraseAt(strokesRef.current, point, ERASER_RADIUS));
        return;
      }

      activeRef.current = { points: [point], width: STROKE_WIDTH };
      repaint();
    },
    [onChange, pointFrom, repaint, tool],
  );

  const handleMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      const point = pointFrom(event);
      if (!point) return;

      if (tool === 'erase') {
        onChange(eraseAt(strokesRef.current, point, ERASER_RADIUS));
        return;
      }

      const stroke = activeRef.current;
      if (!stroke) return;

      const last = stroke.points[stroke.points.length - 1];
      // Skip jitter so a slow finger does not generate hundreds of points.
      if (Math.hypot(point.x - last.x, point.y - last.y) < MIN_POINT_DELTA) return;

      stroke.points.push(point);
      repaint();
    },
    [onChange, pointFrom, repaint, tool],
  );

  const handleUp = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      drawingRef.current = false;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (tool === 'erase') {
        onCommit(strokesRef.current);
        return;
      }

      const stroke = activeRef.current;
      activeRef.current = null;

      if (stroke && stroke.points.length > 1) {
        onCommit([...strokesRef.current, stroke]);
      } else {
        repaint();
      }
    },
    [onCommit, repaint, tool],
  );

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div
        ref={wrapperRef}
        className="relative max-h-full max-w-full"
        style={aspect ? { aspectRatio: String(aspect), width: '100%' } : { width: '100%', height: '100%' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Property"
          crossOrigin="anonymous"
          className="absolute inset-0 h-full w-full object-contain"
          onLoad={(event) => {
            const img = event.currentTarget;
            if (img.naturalWidth && img.naturalHeight) setAspect(img.naturalWidth / img.naturalHeight);
            setImageReady(true);
          }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none no-select"
          style={{ cursor: tool === 'erase' ? 'cell' : 'crosshair' }}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
        />
        {!imageReady ? (
          <div className="absolute inset-0 shimmer rounded-2xl" aria-hidden />
        ) : null}
      </div>
    </div>
  );
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
