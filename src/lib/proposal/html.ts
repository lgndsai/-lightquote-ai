import type { Company, Customer, Property, Quote } from '@/lib/types/db';
import type { PricingResult } from '@/lib/pricing/engine';
import { formatCurrency, formatCurrencyPrecise } from '@/lib/pricing/engine';

export interface ProposalData {
  proposalNumber: string;
  company: Company;
  customer: Customer;
  property: Property;
  quote: Quote;
  pricing: PricingResult;
  renderedImageUrl: string | null;
  levelName: string;
  levelFeatures: string[];
  financeProgramName: string | null;
  salesRepName: string;
  salesRepEmail: string;
  salesRepPhone: string | null;
  issuedAt: string;
}

/** Minimal escaping — every interpolated value below goes through this. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const color = (value: string | null | undefined, fallback: string) =>
  value && HEX.test(value) ? value : fallback;

/**
 * Renders the customer proposal as a self-contained HTML document.
 *
 * HTML rather than a generated PDF: it stores and loads in a fraction of the
 * time on a phone, prints to PDF from any device, and needs no binary
 * rendering dependency on the server.
 */
export function renderProposalHtml(data: ProposalData): string {
  const { company, customer, property, quote, pricing } = data;
  const primary = color(company.brand_primary, '#0B0F19');
  const accent = color(company.brand_accent, '#C8A24A');

  const adderRows = pricing.adderLines
    .map(
      (line) => `
        <tr>
          <td>${esc(line.label)}${line.detail ? `<span class="detail">${esc(line.detail)}</span>` : ''}</td>
          <td class="num">${esc(formatCurrencyPrecise(line.amount))}</td>
        </tr>`,
    )
    .join('');

  const discountRows = pricing.discountLines
    .map(
      (line) => `
        <tr class="credit">
          <td>${esc(line.label)}${line.detail ? `<span class="detail">${esc(line.detail)}</span>` : ''}</td>
          <td class="num">−${esc(formatCurrencyPrecise(line.amount))}</td>
        </tr>`,
    )
    .join('');

  const features = data.levelFeatures
    .map((feature) => `<li>${esc(feature)}</li>`)
    .join('');

  const benefits = (company.proposal_benefits ?? [])
    .map((benefit) => `<li>${esc(benefit)}</li>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Proposal ${esc(data.proposalNumber)} — ${esc(company.name)}</title>
<style>
  :root { --primary: ${esc(primary)}; --accent: ${esc(accent)}; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #f4f5f7; color: #0b0f19;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .sheet { max-width: 780px; margin: 0 auto; background: #fff; }
  .head { background: var(--primary); color: #fff; padding: 28px 32px; display: flex;
          justify-content: space-between; align-items: flex-start; gap: 24px; }
  .head img { max-height: 46px; max-width: 190px; object-fit: contain; }
  .head .brand { font-size: 21px; font-weight: 700; letter-spacing: -0.01em; }
  .head .meta { text-align: right; font-size: 12px; line-height: 1.6; opacity: 0.75; }
  .hero img { display: block; width: 100%; height: auto; }
  .body { padding: 32px; }
  h2 { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
       color: #667085; margin: 32px 0 12px; }
  h2:first-child { margin-top: 0; }
  .to { font-size: 24px; font-weight: 650; letter-spacing: -0.02em; margin: 0; }
  .to + p { margin: 6px 0 0; color: #667085; font-size: 14px; }
  .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 18px; }
  .metric { border: 1px solid #e4e7ec; border-radius: 14px; padding: 14px; text-align: center; }
  .metric span { display: block; font-size: 10px; letter-spacing: 0.1em;
                 text-transform: uppercase; color: #667085; }
  .metric strong { display: block; margin-top: 5px; font-size: 18px; letter-spacing: -0.01em; }
  ul { margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.9; color: #344054; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td { padding: 11px 0; border-bottom: 1px solid #eaecf0; vertical-align: top; }
  td.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .detail { display: block; font-size: 12px; color: #667085; margin-top: 2px; }
  .credit td { color: #0e9f6e; }
  tr.total td { border-bottom: none; border-top: 2px solid var(--primary);
                padding-top: 16px; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
  .finance { margin-top: 16px; border: 1px solid var(--accent); border-radius: 16px;
             padding: 18px 20px; display: flex; justify-content: space-between; align-items: center; }
  .finance strong { font-size: 26px; letter-spacing: -0.02em; }
  .warranty { margin-top: 12px; font-size: 14px; line-height: 1.75; color: #344054; }
  .sign { margin-top: 34px; border-top: 1px solid #e4e7ec; padding-top: 22px;
          display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
  .sign div { border-bottom: 1px solid #98a2b3; padding-bottom: 34px; font-size: 11px;
              letter-spacing: 0.1em; text-transform: uppercase; color: #667085; }
  .foot { padding: 20px 32px 34px; font-size: 11px; line-height: 1.7; color: #98a2b3; }
  @media print { body { background: #fff; } .sheet { max-width: none; } }
</style>
</head>
<body>
<div class="sheet">
  <div class="head">
    <div>
      ${company.logo_url ? `<img src="${esc(company.logo_url)}" alt="${esc(company.name)}" />` : `<div class="brand">${esc(company.name)}</div>`}
      <div class="meta" style="text-align:left;margin-top:8px">
        ${esc([company.address_line1, [company.city, company.state].filter(Boolean).join(', '), company.zip].filter(Boolean).join(' · '))}
        ${company.phone ? `<br />${esc(company.phone)}` : ''}
        ${company.license_number ? `<br />Lic. ${esc(company.license_number)}` : ''}
      </div>
    </div>
    <div class="meta">
      Proposal ${esc(data.proposalNumber)}<br />
      Quote ${esc(quote.quote_number)}<br />
      ${esc(data.issuedAt)}
    </div>
  </div>

  ${data.renderedImageUrl ? `<div class="hero"><img src="${esc(data.renderedImageUrl)}" alt="Your home with lighting" /></div>` : ''}

  <div class="body">
    <h2>Prepared for</h2>
    <p class="to">${esc(`${customer.first_name} ${customer.last_name}`)}</p>
    <p>${esc([property.address_line1, `${property.city}, ${property.state} ${property.zip}`].join(' · '))}</p>

    <div class="metrics">
      <div class="metric"><span>Linear feet</span><strong>${esc(Number(quote.linear_feet))}</strong></div>
      <div class="metric"><span>System</span><strong>${esc(data.levelName)}</strong></div>
      <div class="metric"><span>Track</span><strong>${esc(quote.track_color ?? '—')}</strong></div>
    </div>

    <h2>Your system</h2>
    <ul>${features}</ul>

    ${benefits ? `<h2>Every installation includes</h2><ul>${benefits}</ul>` : ''}

    <h2>Investment</h2>
    <table>
      <tr>
        <td>${esc(Number(quote.linear_feet))} linear feet of permanent lighting
          <span class="detail">${esc(formatCurrencyPrecise(pricing.effectivePricePerFoot))} per foot</span></td>
        <td class="num">${esc(formatCurrencyPrecise(pricing.footageSubtotal))}</td>
      </tr>
      ${
        pricing.controllerPrice > 0
          ? `<tr><td>${esc(quote.controller_name ?? 'Controller')}</td>
               <td class="num">${esc(formatCurrencyPrecise(pricing.controllerPrice))}</td></tr>`
          : ''
      }
      ${adderRows}
      ${discountRows}
      ${
        pricing.dealerFee > 0
          ? `<tr><td>Financing program fee</td>
               <td class="num">${esc(formatCurrencyPrecise(pricing.dealerFee))}</td></tr>`
          : ''
      }
      ${
        pricing.taxAmount > 0
          ? `<tr><td>Sales tax<span class="detail">${esc((pricing.taxRate * 100).toFixed(3).replace(/\.?0+$/, ''))}%</span></td>
               <td class="num">${esc(formatCurrencyPrecise(pricing.taxAmount))}</td></tr>`
          : ''
      }
      <tr class="total">
        <td>Total investment</td>
        <td class="num">${esc(formatCurrency(pricing.total, { maximumFractionDigits: 2, minimumFractionDigits: 2 }))}</td>
      </tr>
    </table>

    ${
      quote.financing_selected && pricing.monthlyPayment > 0
        ? `<div class="finance">
             <div>
               <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#667085">Monthly payment</div>
               <div style="font-size:13px;color:#344054;margin-top:3px">${esc(data.financeProgramName ?? 'Financing')}</div>
             </div>
             <strong>${esc(formatCurrency(pricing.monthlyPayment, { maximumFractionDigits: 0 }))}/mo</strong>
           </div>
           <p style="font-size:11px;color:#98a2b3;margin-top:10px">
             Payment shown is an estimate based on the selected program and is subject to lender approval.
           </p>`
        : ''
    }

    <h2>Warranty</h2>
    <p class="warranty">${esc(company.warranty_copy)}</p>

    <div class="sign">
      <div>Customer signature &amp; date</div>
      <div>${esc(data.salesRepName)} · ${esc(company.name)}</div>
    </div>
  </div>

  <div class="foot">
    Prepared by ${esc(data.salesRepName)}${data.salesRepPhone ? ` · ${esc(data.salesRepPhone)}` : ''} · ${esc(data.salesRepEmail)}<br />
    ${esc(company.name)}${company.website ? ` · ${esc(company.website)}` : ''} · Proposal ${esc(data.proposalNumber)}
  </div>
</div>
</body>
</html>`;
}
