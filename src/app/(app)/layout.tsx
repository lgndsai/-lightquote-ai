import { requireSession } from '@/lib/auth';
import { BrandProvider } from '@/components/BrandProvider';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <BrandProvider company={session.company}>
      <div className="min-h-dvh">{children}</div>
    </BrandProvider>
  );
}
