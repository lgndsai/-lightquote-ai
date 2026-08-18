import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/** Next 16 proxy convention (formerly middleware.ts). */
export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files — those never need a
     * session refresh and skipping them keeps navigation snappy on mobile.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
