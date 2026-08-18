'use client';

/**
 * Downscales a camera capture before upload. iPhone photos are ~4MB at 4032px
 * wide; 2000px at q0.85 is indistinguishable for visualization and uploads in
 * a fraction of the time over a customer's Wi-Fi.
 */
export async function compressImage(file: File, maxEdge = 2000, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );

  return blob ?? file;
}

/** Random, unguessable object key under the tenant's folder. */
export function storagePath(companyId: string, quoteId: string, suffix: string, ext = 'jpg') {
  return `${companyId}/${quoteId}/${suffix}-${crypto.randomUUID()}.${ext}`;
}

/**
 * Composites the traced lighting onto the original photo at full resolution
 * and returns it as a JPEG. This is the "marked photograph" the AI workflow
 * receives alongside the raw coordinates.
 */
export async function exportMarkedImage(
  imageUrl: string,
  strokes: import('@/lib/types/db').RooflineStroke[],
  style: string,
): Promise<Blob> {
  const { drawStrokes } = await import('@/lib/canvas');

  const image = await loadImage(imageUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable on this device.');

  ctx.drawImage(image, 0, 0, width, height);
  drawStrokes(ctx, strokes, width, height, style);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.9),
  );

  if (!blob) throw new Error('Could not export the marked photo.');
  return blob;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // Supabase Storage serves permissive CORS headers; without this the
    // canvas would be tainted and toBlob() would throw.
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load the property photo.'));
    image.src = src;
  });
}
