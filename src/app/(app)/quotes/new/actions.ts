'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';

export interface NewQuoteState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const schema = z.object({
  first_name: z.string().trim().min(1, 'First name is required.'),
  last_name: z.string().trim().min(1, 'Last name is required.'),
  phone: z.string().trim().optional(),
  email: z.string().trim().email('Enter a valid email.').optional().or(z.literal('')),
  address_line1: z.string().trim().min(1, 'Street address is required.'),
  city: z.string().trim().min(1, 'City is required.'),
  state: z.string().trim().min(2, 'State is required.').max(2, 'Use the two-letter state code.'),
  zip: z.string().trim().min(5, 'ZIP is required.'),
});

/**
 * Creates customer -> property -> quote in one submit so the rep types once
 * and lands straight on the camera screen.
 */
export async function createQuoteAction(
  _prev: NewQuoteState,
  formData: FormData,
): Promise<NewQuoteState> {
  const session = await requireSession();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  const input = parsed.data;
  const supabase = await createClient();
  const company_id = session.company.id;
  const created_by = session.user.id;

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .insert({
      company_id,
      created_by,
      first_name: input.first_name,
      last_name: input.last_name,
      phone: input.phone || null,
      email: input.email || null,
    })
    .select('id')
    .single();

  if (customerError || !customer) {
    return { error: customerError?.message ?? 'Could not save the customer.' };
  }

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .insert({
      company_id,
      created_by,
      customer_id: customer.id,
      address_line1: input.address_line1,
      city: input.city,
      state: input.state.toUpperCase(),
      zip: input.zip,
    })
    .select('id')
    .single();

  if (propertyError || !property) {
    return { error: propertyError?.message ?? 'Could not save the property.' };
  }

  // Seed the quote with the company's suggested price so the measurement
  // screen opens pre-filled and the rep can go straight to a number.
  const { data: pricing } = await supabase
    .from('company_pricing')
    .select('suggested_price_per_foot, controller_price')
    .eq('company_id', company_id)
    .maybeSingle();

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert({
      company_id,
      created_by,
      customer_id: customer.id,
      property_id: property.id,
      status: 'draft',
      price_per_foot: pricing?.suggested_price_per_foot ?? 0,
      controller_price: pricing?.controller_price ?? 0,
    })
    .select('id')
    .single();

  if (quoteError || !quote) {
    return { error: quoteError?.message ?? 'Could not start the quote.' };
  }

  redirect(`/quotes/${quote.id}/photo`);
}
