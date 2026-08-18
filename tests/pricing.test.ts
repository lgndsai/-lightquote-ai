import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateQuote, monthlyPayment } from '../src/lib/pricing/engine';
import type { CompanyPricing, FinanceProgram, ProposalLevel } from '../src/lib/types/db';

const pricing: CompanyPricing = {
  id: 'p1',
  company_id: 'c1',
  suggested_price_per_foot: 32,
  min_price_per_foot: 24,
  controller_price: 399,
  tax_rate: 0.0825,
  tax_on_labor: true,
  labor_percent_of_price: 0.5,
  minimum_job_price: 0,
  proposal_levels: [],
  created_at: '',
  updated_at: '',
};

const program: FinanceProgram = {
  id: 'f1',
  company_id: 'c1',
  name: '120 months',
  provider: 'Partner',
  term_months: 120,
  apr: 0.0999,
  payment_factor: 0,
  dealer_fee_percent: 0.12,
  min_amount: 0,
  max_amount: null,
  is_active: true,
  sort_order: 1,
  created_at: '',
  updated_at: '',
};

const base = {
  linearFeet: 150,
  pricePerFoot: 32,
  controllerPrice: 399,
  proposalLevel: null,
  adders: [],
  discounts: [],
  financing: false,
  pricing,
};

describe('pricing engine', () => {
  it('prices footage, controller and tax for a cash job', () => {
    const result = calculateQuote(base);

    assert.equal(result.footageSubtotal, 4800);
    assert.equal(result.subtotal, 5199);
    assert.equal(result.taxAmount, 428.92);
    assert.equal(result.total, 5627.92);
    assert.equal(result.monthlyPayment, 0);
  });

  it('resolves per_foot, each, flat and percent adders against the job', () => {
    const result = calculateQuote({
      ...base,
      adders: [
        { catalog_item_id: null, name: 'Second story', unit: 'per_foot', unit_price: 4, quantity: 1 },
        { catalog_item_id: null, name: 'Landscape', unit: 'each', unit_price: 285, quantity: 3 },
        { catalog_item_id: null, name: 'Permit', unit: 'flat', unit_price: 175, quantity: 1 },
        { catalog_item_id: null, name: 'Access', unit: 'percent', unit_price: 10, quantity: 1 },
      ],
    });

    // 600 + 855 + 175 + 480 (10% of the 4800 footage subtotal)
    assert.equal(result.addersTotal, 2110);
  });

  it('applies percentage discounts to the pre-discount subtotal', () => {
    const result = calculateQuote({
      ...base,
      discounts: [{ catalog_item_id: null, name: 'Referral', unit: 'percent', price: 5 }],
    });

    assert.equal(result.discountTotal, 259.95);
    assert.equal(result.subtotal, 4939.05);
  });

  it('never discounts below zero', () => {
    const result = calculateQuote({
      ...base,
      linearFeet: 10,
      controllerPrice: 0,
      discounts: [{ catalog_item_id: null, name: 'Too big', unit: 'flat', price: 99999 }],
    });

    assert.equal(result.subtotal, 0);
    assert.equal(result.total, 0);
  });

  it('adds the dealer fee only when financing and derives a payment', () => {
    const cash = calculateQuote(base);
    const financed = calculateQuote({ ...base, financing: true, financeProgram: program });

    assert.equal(cash.dealerFee, 0);
    assert.equal(financed.dealerFee, 623.88);
    assert.ok(financed.total > cash.total);
    assert.ok(financed.monthlyPayment > 0);
  });

  it('shifts price per foot by the proposal level delta', () => {
    const level: ProposalLevel = {
      key: 'whole_home',
      name: 'Whole Home',
      description: '',
      price_per_foot_delta: 4,
      features: [],
    };
    const result = calculateQuote({ ...base, proposalLevel: level });

    assert.equal(result.effectivePricePerFoot, 36);
    assert.equal(result.footageSubtotal, 5400);
  });

  it('flags a price below the company minimum', () => {
    const result = calculateQuote({ ...base, pricePerFoot: 20 });
    assert.equal(result.belowMinimumPricePerFoot, true);
  });

  it('exempts the labor share when labor is not taxed', () => {
    const taxed = calculateQuote(base);
    const exempt = calculateQuote({ ...base, pricing: { ...pricing, tax_on_labor: false } });

    // Half of the 4800 footage subtotal drops out of the taxable base.
    assert.equal(exempt.taxableBase, taxed.taxableBase - 2400);
    assert.ok(exempt.taxAmount < taxed.taxAmount);
  });

  it('raises a small job to the company minimum', () => {
    const result = calculateQuote({
      ...base,
      linearFeet: 20,
      controllerPrice: 0,
      pricing: { ...pricing, minimum_job_price: 2500, tax_rate: 0 },
    });

    assert.equal(result.minimumJobPriceApplied, true);
    assert.equal(result.total, 2500);
  });

  it('prefers a lender payment factor over APR amortization', () => {
    const factored = monthlyPayment(10000, { ...program, payment_factor: 12.5 });
    const amortized = monthlyPayment(10000, program);

    assert.equal(factored, 125);
    assert.equal(amortized, 132.1);
  });

  it('splits a zero-APR program evenly across its term', () => {
    assert.equal(monthlyPayment(1200, { ...program, apr: 0, term_months: 12 }), 100);
  });
});
