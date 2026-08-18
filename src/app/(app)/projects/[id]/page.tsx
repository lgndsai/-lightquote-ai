import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { signedUrl } from '@/lib/storage';
import { AppHeader } from '@/components/AppHeader';
import { ProjectDetail } from './ProjectDetail';
import type { Customer, Design, Project, Property, Quote } from '@/lib/types/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Project — LumaGlow' };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from('projects')
    .select('*, customers(*), properties(*), quotes(*), designs(*)')
    .eq('id', id)
    .maybeSingle();

  if (!data) notFound();

  const row = data as unknown as Project & {
    customers: Customer | null;
    properties: Property | null;
    quotes: Quote | null;
    designs: Design | null;
  };

  // renders is a private bucket — mint a fresh signed URL rather than
  // trusting whatever the raw row happened to carry.
  if (row.designs?.rendered_image_path) {
    row.designs = {
      ...row.designs,
      rendered_image_url: await signedUrl(supabase, 'renders', row.designs.rendered_image_path),
    };
  }

  return (
    <>
      <AppHeader session={session} />
      <ProjectDetail
        project={row}
        customer={row.customers}
        property={row.properties}
        quote={row.quotes}
        design={row.designs}
        canEdit={session.user.role !== 'sales_rep' || row.sales_rep_id === session.user.id}
      />
    </>
  );
}
