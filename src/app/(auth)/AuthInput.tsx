'use client';

import type { ComponentProps } from 'react';

export function AuthInput({ className = '', ...rest }: ComponentProps<'input'>) {
  return (
    <input
      className={`w-full min-h-14 rounded-2xl border border-white/12 bg-white/8 px-4 text-white
        placeholder:text-white/45 backdrop-blur transition-colors
        focus:border-accent/70 focus:bg-white/12 focus:outline-none focus:ring-2 focus:ring-accent/25 ${className}`}
      {...rest}
    />
  );
}
