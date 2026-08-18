import type {
  CatalogItem,
  CompanyPricing,
  FinanceProgram,
  PriceUnit,
  ProposalLevel,
  QuoteAdder,
} from '@/lib/types/db';

/**
 * Pricing engine.
 *
 * Every number here comes from company_pricing / company_catalog_items /
 * finance_programs. Nothing about price lives in a React component — screens
 * render the result of `calculateQuote`, they never compute it.
 */

export interface SelectedAdder {
  catalog_item_id: string | null;
  name: string;
  unit: PriceUnit;
  unit_price: number;
  quantity: number;
}

export interface SelectedDiscount {
  catalog_item_id: string | null;
  name: string;
  unit: PriceUnit;
  price: number;
}

export interface PricingInput {
  linearFeet: number;
  /** Rep-entered price per foot, before the proposal-level adjustment. */
  pricePerFoot: number;
  controllerPrice: number;
  proposalLevel?: ProposalLevel | null;
  adders: SelectedAdder[];
  discounts: SelectedDiscount[];
  financing: boolean;
  financeProgram?: FinanceProgram | null;
  pricing: CompanyPricing;
}

export interface LineItem {
  label: string;
  detail?: string;
  amount: number;
}

export interface PricingResult {
  linearFeet: number;
  /** pricePerFoot after the proposal-level delta. */
  effectivePricePerFoot: number;
  footageSubtotal: number;
  controllerPrice: number;
  addersTotal: number;
  adderLines: LineItem[];
  discountTotal: number;
  discountLines: LineItem[];
  dealerFee: number;
  dealerFeePercent: number;
  subtotal: number;
  taxableBase: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  monthlyPayment: number;
  financeTermMonths: number | null;
  belowMinimumPricePerFoot: boolean;
  minimumJobPriceApplied: boolean;
}

const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const num = (n: unknown) => {
  const v = typeof n === 'string' ? Number.parseFloat(n) : Number(n);
  return Number.isFinite(v) ? v : 0;
};

/** Resolves one adder line against the job size. */
export function adderAmount(unit: PriceUnit, unitPrice: number, quantity: number, linearFeet: number, base: number) {
  switch (unit) {
    case 'per_foot':
      return unitPrice * linearFeet * quantity;
    case 'each':
      return unitPrice * quantity;
    case 'percent':
      return base * (unitPrice / 100) * quantity;
    case 'flat':
    default:
      return unitPrice * quantity;
  }
}

/**
 * Monthly payment. A dealer's payment_factor (payment per $1,000 financed)
 * always wins over APR amortization because that is the number the lender
 * publishes; APR is the fallback.
 */
export function monthlyPayment(amount: number, program: FinanceProgram | null | undefined): number {
  if (!program || amount <= 0) return 0;

  const factor = num(program.payment_factor);
  if (factor > 0) return round2((amount / 1000) * factor);

  const months = Math.max(1, Math.round(num(program.term_months)));
  const monthlyRate = num(program.apr) / 12;

  if (monthlyRate <= 0) return round2(amount / months);

  const payment = (amount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
  return round2(payment);
}

export function calculateQuote(input: PricingInput): PricingResult {
  const { pricing } = input;

  const linearFeet = Math.max(0, num(input.linearFeet));
  const levelDelta = num(input.proposalLevel?.price_per_foot_delta);
  const effectivePricePerFoot = Math.max(0, round2(num(input.pricePerFoot) + levelDelta));

  const footageSubtotal = round2(linearFeet * effectivePricePerFoot);
  const controllerPrice = round2(Math.max(0, num(input.controllerPrice)));

  // Adders resolve against the footage subtotal for percentage-based lines.
  const adderLines: LineItem[] = input.adders.map((a) => {
    const quantity = Math.max(0, num(a.quantity) || 1);
    const unitPrice = num(a.unit_price);
    const amount = round2(adderAmount(a.unit, unitPrice, quantity, linearFeet, footageSubtotal));
    return {
      label: a.name,
      detail: describeUnit(a.unit, unitPrice, quantity, linearFeet),
      amount,
    };
  });
  const addersTotal = round2(adderLines.reduce((sum, l) => sum + l.amount, 0));

  const preDiscount = round2(footageSubtotal + controllerPrice + addersTotal);

  const discountLines: LineItem[] = input.discounts.map((d) => {
    const price = num(d.price);
    const amount =
      d.unit === 'percent' ? round2(preDiscount * (price / 100)) : round2(price);
    return { label: d.name, detail: d.unit === 'percent' ? `${price}%` : undefined, amount };
  });
  const discountTotal = round2(Math.min(preDiscount, discountLines.reduce((s, l) => s + l.amount, 0)));

  const afterDiscount = round2(Math.max(0, preDiscount - discountTotal));

  // Dealer fee only applies when the homeowner finances.
  const dealerFeePercent = input.financing
    ? num(input.financeProgram?.dealer_fee_percent) || num(pricing.dealer_fee_percent)
    : 0;
  const dealerFee = round2(afterDiscount * dealerFeePercent);

  let subtotal = round2(afterDiscount + dealerFee);

  const minimumJobPrice = num(pricing.minimum_job_price);
  const minimumJobPriceApplied = linearFeet > 0 && minimumJobPrice > 0 && subtotal < minimumJobPrice;
  if (minimumJobPriceApplied) subtotal = round2(minimumJobPrice);

  // Some jurisdictions do not tax installation labor.
  const laborShare = Math.min(1, Math.max(0, num(pricing.labor_percent_of_price)));
  const untaxedLabor = pricing.tax_on_labor ? 0 : round2(footageSubtotal * laborShare);
  const taxableBase = round2(Math.max(0, subtotal - untaxedLabor));

  const taxRate = num(pricing.tax_rate);
  const taxAmount = round2(taxableBase * taxRate);
  const total = round2(subtotal + taxAmount);

  const payment = input.financing ? monthlyPayment(total, input.financeProgram) : 0;

  return {
    linearFeet,
    effectivePricePerFoot,
    footageSubtotal,
    controllerPrice,
    addersTotal,
    adderLines,
    discountTotal,
    discountLines,
    dealerFee,
    dealerFeePercent,
    subtotal,
    taxableBase,
    taxRate,
    taxAmount,
    total,
    monthlyPayment: payment,
    financeTermMonths: input.financeProgram?.term_months ?? null,
    belowMinimumPricePerFoot:
      linearFeet > 0 && effectivePricePerFoot < num(pricing.min_price_per_foot),
    minimumJobPriceApplied,
  };
}

function describeUnit(unit: PriceUnit, unitPrice: number, quantity: number, linearFeet: number) {
  switch (unit) {
    case 'per_foot':
      return `${formatCurrency(unitPrice)}/ft x ${linearFeet} ft`;
    case 'each':
      return `${formatCurrency(unitPrice)} x ${quantity}`;
    case 'percent':
      return `${unitPrice}%`;
    default:
      return undefined;
  }
}

export function formatCurrency(value: number, options: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    ...options,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatCurrencyPrecise(value: number) {
  return formatCurrency(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Turns catalog rows into engine inputs. */
export function toSelectedAdder(item: CatalogItem, quantity = 1): SelectedAdder {
  return {
    catalog_item_id: item.id,
    name: item.name,
    unit: item.unit,
    unit_price: num(item.price),
    quantity,
  };
}

export function fromQuoteAdder(row: QuoteAdder): SelectedAdder {
  return {
    catalog_item_id: row.catalog_item_id,
    name: row.name,
    unit: row.unit,
    unit_price: num(row.unit_price),
    quantity: num(row.quantity) || 1,
  };
}

export function toSelectedDiscount(item: CatalogItem): SelectedDiscount {
  return {
    catalog_item_id: item.id,
    name: item.name,
    unit: item.unit,
    price: num(item.price),
  };
}
