'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth';
import { appUrl } from '@/lib/env';

export interface AdminState {
  ok?: boolean;
  error?: string;
  message?: string;
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const lines = (value: unknown) =>
  String(value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

// ---------------------------------------------------------------- company

const companySchema = z.object({
  name: z.string().trim().min(2, 'Company name is required.'),
  logo_url: z.string().trim().url('Enter a valid logo URL.').or(z.literal('')).optional(),
  brand_primary: z.string().regex(HEX, 'Use a hex color like #7C3AED.'),
  brand_secondary: z.string().regex(HEX, 'Use a hex color like #170F26.'),
  brand_accent: z.string().regex(HEX, 'Use a hex color like #E0299B.'),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email('Enter a valid email.').or(z.literal('')).optional(),
  website: z.string().trim().max(200).optional(),
  address_line1: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(2).optional(),
  zip: z.string().trim().max(12).optional(),
  license_number: z.string().trim().max(80).optional(),
  warranty_copy: z.string().trim().max(4000),
  proposal_benefits: z.string().max(4000).optional(),
});

export async function updateCompany(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const session = await requireRole('admin');

  const parsed = companySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the company details.' };
  }

  const input = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from('companies')
    .update({
      name: input.name,
      logo_url: input.logo_url || null,
      brand_primary: input.brand_primary,
      brand_secondary: input.brand_secondary,
      brand_accent: input.brand_accent,
      phone: input.phone || null,
      email: input.email || null,
      website: input.website || null,
      address_line1: input.address_line1 || null,
      city: input.city || null,
      state: input.state ? input.state.toUpperCase() : null,
      zip: input.zip || null,
      license_number: input.license_number || null,
      warranty_copy: input.warranty_copy,
      proposal_benefits: lines(input.proposal_benefits),
    })
    .eq('id', session.company.id);

  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return { ok: true, message: 'Company saved.' };
}

// ---------------------------------------------------------------- pricing

const pricingSchema = z.object({
  retail_price_per_ft: z.coerce.number().min(0).max(10000),
  standard_price_per_ft: z.coerce.number().min(0).max(10000),
  show_retail_comparison: z.coerce.boolean().optional(),
  retail_label: z.string().trim().min(1).max(60),
  selling_price_label: z.string().trim().min(1).max(60),
  savings_label: z.string().trim().min(1).max(60),
  tax_rate: z.coerce.number().min(0).max(0.5),
  tax_on_labor: z.coerce.boolean().optional(),
  labor_percent_of_price: z.coerce.number().min(0).max(1),
  dealer_fee_percent: z.coerce.number().min(0).max(1),
  minimum_job_price: z.coerce.number().min(0).max(1000000),
});

export async function updatePricing(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const session = await requireRole('admin');

  const raw = Object.fromEntries(formData);
  const parsed = pricingSchema.safeParse({
    ...raw,
    tax_on_labor: raw.tax_on_labor === 'on',
    show_retail_comparison: raw.show_retail_comparison === 'on',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the pricing values.' };
  }

  const input = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from('company_pricing').upsert(
    {
      company_id: session.company.id,
      retail_price_per_ft: input.retail_price_per_ft,
      standard_price_per_ft: input.standard_price_per_ft,
      show_retail_comparison: Boolean(input.show_retail_comparison),
      retail_label: input.retail_label,
      selling_price_label: input.selling_price_label,
      savings_label: input.savings_label,
      tax_rate: input.tax_rate,
      tax_on_labor: Boolean(input.tax_on_labor),
      labor_percent_of_price: input.labor_percent_of_price,
      dealer_fee_percent: input.dealer_fee_percent,
      minimum_job_price: input.minimum_job_price,
    },
    { onConflict: 'company_id' },
  );

  if (error) return { error: error.message };

  revalidatePath('/admin/pricing');
  revalidatePath('/quotes', 'layout');
  return { ok: true, message: 'Pricing saved.' };
}

// ---------------------------------------------------------------- catalog

const catalogSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  kind: z.enum(['adder', 'controller', 'track_color', 'discount']),
  name: z.string().trim().min(1, 'Name is required.').max(120),
  description: z.string().trim().max(400).optional(),
  price: z.coerce.number().min(0).max(1000000),
  unit: z.enum(['flat', 'per_foot', 'each', 'percent']),
  sort_order: z.coerce.number().int().min(0).max(9999).optional(),
  is_active: z.coerce.boolean().optional(),
});

export async function saveCatalogItem(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const session = await requireRole('admin');

  const raw = Object.fromEntries(formData);
  const parsed = catalogSchema.safeParse({ ...raw, is_active: raw.is_active !== 'off' });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the item details.' };
  }

  const input = parsed.data;
  const supabase = await createClient();

  const payload = {
    company_id: session.company.id,
    kind: input.kind,
    name: input.name,
    description: input.description || null,
    price: input.price,
    unit: input.unit,
    sort_order: input.sort_order ?? 0,
    is_active: input.is_active ?? true,
  };

  const { error } = input.id
    ? await supabase.from('company_catalog_items').update(payload).eq('id', input.id)
    : await supabase.from('company_catalog_items').insert(payload);

  if (error) return { error: error.message };

  revalidatePath('/admin/catalog');
  return { ok: true, message: 'Saved.' };
}

export async function deleteCatalogItem(id: string): Promise<AdminState> {
  await requireRole('admin');
  const supabase = await createClient();

  // Soft delete: existing quotes keep their snapshot, new quotes stop offering it.
  const { error } = await supabase
    .from('company_catalog_items')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/admin/catalog');
  return { ok: true };
}

// -------------------------------------------------------- finance programs

const financeSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  name: z.string().trim().min(1, 'Name is required.').max(120),
  provider: z.string().trim().max(120).optional(),
  term_months: z.coerce.number().int().min(1).max(600),
  apr: z.coerce.number().min(0).max(1),
  payment_factor: z.coerce.number().min(0).max(1000),
  dealer_fee_percent: z.coerce.number().min(0).max(1),
  min_amount: z.coerce.number().min(0).max(1000000),
  sort_order: z.coerce.number().int().min(0).max(9999).optional(),
  is_active: z.coerce.boolean().optional(),
});

export async function saveFinanceProgram(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const session = await requireRole('admin');

  const raw = Object.fromEntries(formData);
  const parsed = financeSchema.safeParse({ ...raw, is_active: raw.is_active !== 'off' });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the program details.' };
  }

  const input = parsed.data;
  const supabase = await createClient();

  const payload = {
    company_id: session.company.id,
    name: input.name,
    provider: input.provider || null,
    term_months: input.term_months,
    apr: input.apr,
    payment_factor: input.payment_factor,
    dealer_fee_percent: input.dealer_fee_percent,
    min_amount: input.min_amount,
    sort_order: input.sort_order ?? 0,
    is_active: input.is_active ?? true,
  };

  const { error } = input.id
    ? await supabase.from('finance_programs').update(payload).eq('id', input.id)
    : await supabase.from('finance_programs').insert(payload);

  if (error) return { error: error.message };

  revalidatePath('/admin/finance');
  return { ok: true, message: 'Saved.' };
}

export async function deleteFinanceProgram(id: string): Promise<AdminState> {
  await requireRole('admin');
  const supabase = await createClient();

  const { error } = await supabase.from('finance_programs').update({ is_active: false }).eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/admin/finance');
  return { ok: true };
}

// ------------------------------------------------------------------ users

const inviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
  full_name: z.string().trim().min(2, 'Enter the person’s name.').max(120),
  role: z.enum(['admin', 'manager', 'sales_rep']),
});

/**
 * Invites a teammate into this company. The service-role client is required
 * to create an auth user, and company_id is taken from the caller's own
 * session — never from the form — so an admin can only invite into their
 * own tenant.
 */
export async function inviteUser(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const session = await requireRole('admin');

  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the invite details.' };
  }

  const input = parsed.data;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: 'Inviting users needs SUPABASE_SERVICE_ROLE_KEY to be configured.' };
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(input.email, {
    data: {
      full_name: input.full_name,
      role: input.role,
      company_id: session.company.id,
    },
    redirectTo: `${appUrl}/login`,
  });

  if (error) return { error: error.message };

  revalidatePath('/admin/users');
  return { ok: true, message: `Invitation sent to ${input.email}.` };
}

const userUpdateSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['admin', 'manager', 'sales_rep']).optional(),
  is_active: z.boolean().optional(),
});

export async function updateTeamMember(input: z.input<typeof userUpdateSchema>): Promise<AdminState> {
  const session = await requireRole('admin');

  const parsed = userUpdateSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid change.' };

  const { user_id, role, is_active } = parsed.data;

  // Guard against an admin locking themselves out of their own company.
  if (user_id === session.user.id && (role !== undefined || is_active === false)) {
    return { error: 'You cannot change your own role or deactivate yourself.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('users')
    .update({
      ...(role !== undefined ? { role } : {}),
      ...(is_active !== undefined ? { is_active } : {}),
    })
    .eq('id', user_id);

  if (error) return { error: error.message };

  revalidatePath('/admin/users');
  return { ok: true };
}

// -------------------------------------------------------------- marketing

const marketingSchema = z.object({
  show_long_term_comparison: z.coerce.boolean().optional(),
  alternative_name: z.string().trim().min(1).max(120),
  alternative_installed_cost: z.coerce.number().min(0).max(1000000),
  alternative_replacement_interval_years: z.coerce.number().min(0.5).max(100),
  comparison_horizon_years: z.coerce.number().min(1).max(100),
  comparison_disclaimer: z.string().trim().max(2000),

  show_resale_stat: z.coerce.boolean().optional(),
  resale_headline: z.string().trim().min(1).max(40),
  resale_label: z.string().trim().min(1).max(120),
  resale_body: z.string().trim().max(2000),
  resale_source: z.string().trim().max(400),
  resale_disclaimer: z.string().trim().max(2000),

  show_secondary_resale_stat: z.coerce.boolean().optional(),
  secondary_resale_headline: z.string().trim().min(1).max(40),
  secondary_resale_label: z.string().trim().min(1).max(120),
  secondary_resale_body: z.string().trim().max(2000),
  secondary_resale_source: z.string().trim().max(400),
  secondary_resale_disclaimer: z.string().trim().max(2000),

  show_security_stat: z.coerce.boolean().optional(),
  security_headline: z.string().trim().min(1).max(60),
  security_body: z.string().trim().max(2000),
  security_secondary_line: z.string().trim().max(400),
  security_source: z.string().trim().max(400),
  security_disclaimer: z.string().trim().max(2000),

  benefits: z.string().optional(),
});

export async function updateMarketingConfig(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const session = await requireRole('admin');

  const raw = Object.fromEntries(formData);
  const parsed = marketingSchema.safeParse({
    ...raw,
    show_long_term_comparison: raw.show_long_term_comparison === 'on',
    show_resale_stat: raw.show_resale_stat === 'on',
    show_secondary_resale_stat: raw.show_secondary_resale_stat === 'on',
    show_security_stat: raw.show_security_stat === 'on',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the marketing configuration.' };
  }

  const input = parsed.data;

  let benefits: unknown;
  try {
    benefits = input.benefits ? JSON.parse(input.benefits) : [];
  } catch {
    return { error: 'Benefits must be valid JSON.' };
  }
  if (
    !Array.isArray(benefits) ||
    !benefits.every(
      (b) => b && typeof b === 'object' && typeof b.title === 'string' && typeof b.body === 'string',
    )
  ) {
    return { error: 'Benefits must be a JSON array of { title, body }.' };
  }
  if (benefits.length > 6) {
    return { error: 'Use at most 6 benefits — the proposal is designed not to overwhelm the homeowner.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('company_marketing_config').upsert(
    {
      company_id: session.company.id,
      show_long_term_comparison: Boolean(input.show_long_term_comparison),
      alternative_name: input.alternative_name,
      alternative_installed_cost: input.alternative_installed_cost,
      alternative_replacement_interval_years: input.alternative_replacement_interval_years,
      comparison_horizon_years: input.comparison_horizon_years,
      comparison_disclaimer: input.comparison_disclaimer,

      show_resale_stat: Boolean(input.show_resale_stat),
      resale_headline: input.resale_headline,
      resale_label: input.resale_label,
      resale_body: input.resale_body,
      resale_source: input.resale_source,
      resale_disclaimer: input.resale_disclaimer,

      show_secondary_resale_stat: Boolean(input.show_secondary_resale_stat),
      secondary_resale_headline: input.secondary_resale_headline,
      secondary_resale_label: input.secondary_resale_label,
      secondary_resale_body: input.secondary_resale_body,
      secondary_resale_source: input.secondary_resale_source,
      secondary_resale_disclaimer: input.secondary_resale_disclaimer,

      show_security_stat: Boolean(input.show_security_stat),
      security_headline: input.security_headline,
      security_body: input.security_body,
      security_secondary_line: input.security_secondary_line,
      security_source: input.security_source,
      security_disclaimer: input.security_disclaimer,

      benefits,
    },
    { onConflict: 'company_id' },
  );

  if (error) return { error: error.message };

  revalidatePath('/admin/marketing');
  revalidatePath('/quotes', 'layout');
  return { ok: true, message: 'Marketing configuration saved.' };
}
