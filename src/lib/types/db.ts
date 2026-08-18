/**
 * Domain types mirroring supabase/migrations. Hand-maintained so the app can
 * stay strongly typed without a generated-types build step.
 */

export type UserRole = 'admin' | 'manager' | 'sales_rep';
export type QuoteStatus = 'draft' | 'pending' | 'sold' | 'lost';
export type DesignStatus = 'pending' | 'processing' | 'complete' | 'failed';
export type ProjectStatus = 'sold' | 'scheduled' | 'installed' | 'cancelled';
export type CatalogKind = 'adder' | 'controller' | 'track_color' | 'discount';
export type PriceUnit = 'flat' | 'per_foot' | 'each' | 'percent';

export const LIGHTING_STYLES = [
  { key: 'warm_white', label: 'Warm White', swatch: '#FFC98B' },
  { key: 'soft_white', label: 'Soft White', swatch: '#FFF3DC' },
  { key: 'holiday', label: 'Holiday', swatch: '#E23B3B' },
  { key: 'team_colors', label: 'Team Colors', swatch: '#3B82F6' },
  { key: 'security', label: 'Security', swatch: '#FFFFFF' },
] as const;

export type LightingStyle = (typeof LIGHTING_STYLES)[number]['key'];

export const VISUALIZATION_PRESETS = [
  { key: 'warm_white', label: 'Warm White', swatch: '#FFC98B' },
  { key: 'christmas', label: 'Christmas', swatch: '#D62828' },
  { key: 'fourth_of_july', label: '4th of July', swatch: '#2563EB' },
  { key: 'game_day', label: 'Game Day', swatch: '#F59E0B' },
] as const;

export type VisualizationPreset = (typeof VISUALIZATION_PRESETS)[number]['key'];

/** A single traced stroke, stored as normalized 0..1 coordinates. */
export interface RooflinePoint {
  x: number;
  y: number;
}

export interface RooflineStroke {
  points: RooflinePoint[];
  width: number;
}

export interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  brand_primary: string;
  brand_accent: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  license_number: string | null;
  warranty_copy: string;
  proposal_benefits: string[];
  created_at: string;
  updated_at: string;
}

export interface AppUser {
  id: string;
  company_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  company_id: string;
  created_by: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  company_id: string;
  customer_id: string;
  created_by: string | null;
  address_line1: string;
  city: string;
  state: string;
  zip: string;
  stories: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Design {
  id: string;
  company_id: string;
  quote_id: string;
  property_id: string | null;
  created_by: string | null;
  original_image_path: string | null;
  original_image_url: string | null;
  marked_image_path: string | null;
  marked_image_url: string | null;
  rendered_image_path: string | null;
  rendered_image_url: string | null;
  roofline_coordinates: RooflineStroke[];
  lighting_style: string;
  preset: string | null;
  status: DesignStatus;
  error_message: string | null;
  job_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Quote {
  id: string;
  company_id: string;
  customer_id: string;
  property_id: string;
  created_by: string | null;
  selected_design_id: string | null;
  quote_number: string;
  status: QuoteStatus;
  linear_feet: number;
  track_color: string | null;
  controller_name: string | null;
  controller_price: number;
  price_per_foot: number;
  proposal_level: string;
  finance_program_id: string | null;
  financing_selected: boolean;
  footage_subtotal: number;
  adders_total: number;
  discount_total: number;
  dealer_fee: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  monthly_payment: number;
  pricing_breakdown: Record<string, unknown>;
  selected_discount_ids: string[];
  notes: string | null;
  presented_at: string | null;
  sold_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteAdder {
  id: string;
  company_id: string;
  quote_id: string;
  catalog_item_id: string | null;
  name: string;
  unit: PriceUnit;
  unit_price: number;
  quantity: number;
  total: number;
  created_at: string;
  updated_at: string;
}

export interface ProposalLevel {
  key: string;
  name: string;
  description: string;
  price_per_foot_delta: number;
  features: string[];
}

export interface CompanyPricing {
  id: string;
  company_id: string;
  suggested_price_per_foot: number;
  min_price_per_foot: number;
  controller_price: number;
  tax_rate: number;
  tax_on_labor: boolean;
  labor_percent_of_price: number;
  dealer_fee_percent: number;
  minimum_job_price: number;
  proposal_levels: ProposalLevel[];
  created_at: string;
  updated_at: string;
}

export interface CatalogItem {
  id: string;
  company_id: string;
  kind: CatalogKind;
  name: string;
  description: string | null;
  price: number;
  unit: PriceUnit;
  sort_order: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FinanceProgram {
  id: string;
  company_id: string;
  name: string;
  provider: string | null;
  term_months: number;
  apr: number;
  payment_factor: number;
  dealer_fee_percent: number;
  min_amount: number;
  max_amount: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Proposal {
  id: string;
  company_id: string;
  quote_id: string;
  created_by: string | null;
  proposal_number: string;
  storage_path: string | null;
  total_amount: number;
  monthly_payment: number;
  snapshot: Record<string, unknown>;
  accepted_at: string | null;
  accepted_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  company_id: string;
  quote_id: string;
  customer_id: string;
  property_id: string;
  design_id: string | null;
  proposal_id: string | null;
  sales_rep_id: string | null;
  status: ProjectStatus;
  contract_value: number;
  sold_at: string;
  scheduled_at: string | null;
  installed_at: string | null;
  cancelled_at: string | null;
  install_notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Shape used by the dashboard and quote lists. */
export interface QuoteListItem extends Quote {
  customers: Pick<Customer, 'first_name' | 'last_name'> | null;
  properties: Pick<Property, 'address_line1' | 'city' | 'state' | 'zip'> | null;
  projects: Pick<Project, 'status'>[] | null;
}
