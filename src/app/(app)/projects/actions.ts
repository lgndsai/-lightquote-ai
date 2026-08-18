'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { sendDealInstalled } from '@/lib/n8n';
import type { Customer, Project, Property, Quote } from '@/lib/types/db';

export interface ProjectState {
  ok?: boolean;
  error?: string;
}

const schema = z.object({
  project_id: z.string().uuid(),
  status: z.enum(['sold', 'scheduled', 'installed', 'cancelled']),
  scheduled_at: z.string().datetime().nullable().optional(),
  install_notes: z.string().max(4000).nullable().optional(),
});

/**
 * Advances a project through sold -> scheduled -> installed (or cancelled).
 * Reaching 'installed' notifies the deal-installed automation; as with
 * deal-sold, a failing webhook never blocks the status change.
 */
export async function updateProjectStatus(input: z.input<typeof schema>): Promise<ProjectState> {
  const session = await requireSession();

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid project update.' };
  }

  const { project_id, status, scheduled_at, install_notes } = parsed.data;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from('projects')
    .select('*, quotes(*), customers(*), properties(*)')
    .eq('id', project_id)
    .maybeSingle();

  if (!project) return { error: 'Project not found.' };

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('projects')
    .update({
      status,
      ...(install_notes !== undefined ? { install_notes } : {}),
      ...(status === 'scheduled' ? { scheduled_at: scheduled_at ?? now } : {}),
      ...(status === 'installed' ? { installed_at: now } : {}),
      ...(status === 'cancelled' ? { cancelled_at: now } : {}),
    })
    .eq('id', project_id);

  if (updateError) return { error: updateError.message };

  if (status === 'installed') {
    const row = project as Project & {
      quotes: Quote | null;
      customers: Customer | null;
      properties: Property | null;
    };

    await sendDealInstalled({
      project_id,
      company_id: row.company_id,
      quote_id: row.quote_id,
      quote_number: row.quotes?.quote_number ?? null,
      contract_value: Number(row.contract_value),
      sold_at: row.sold_at,
      installed_at: now,
      install_notes: install_notes ?? row.install_notes,
      sales_rep: { id: session.user.id, name: session.user.full_name, email: session.user.email },
      customer: row.customers
        ? {
            id: row.customers.id,
            first_name: row.customers.first_name,
            last_name: row.customers.last_name,
            phone: row.customers.phone,
            email: row.customers.email,
          }
        : null,
      property: row.properties
        ? {
            id: row.properties.id,
            address_line1: row.properties.address_line1,
            city: row.properties.city,
            state: row.properties.state,
            zip: row.properties.zip,
          }
        : null,
    });
  }

  revalidatePath('/projects');
  revalidatePath(`/projects/${project_id}`);
  revalidatePath('/dashboard');

  return { ok: true };
}
