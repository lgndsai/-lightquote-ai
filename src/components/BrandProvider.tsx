import type { Company } from '@/lib/types/db';

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const safe = (value: string | null | undefined, fallback: string) =>
  value && HEX.test(value) ? value : fallback;

/**
 * Applies the company's brand colors as CSS variables for the subtree.
 * Values are hex-validated before they reach the stylesheet.
 */
export function BrandProvider({
  company,
  children,
}: {
  company: Pick<Company, 'brand_primary' | 'brand_accent'>;
  children: React.ReactNode;
}) {
  return (
    <div
      style={
        {
          '--brand-primary': safe(company.brand_primary, '#0B0F19'),
          '--brand-accent': safe(company.brand_accent, '#C8A24A'),
        } as React.CSSProperties
      }
      className="contents"
    >
      {children}
    </div>
  );
}
