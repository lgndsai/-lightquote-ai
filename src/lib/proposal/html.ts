import type { Company, CompanyMarketingConfig, Customer, Property, Quote } from '@/lib/types/db';
import type { PricingResult } from '@/lib/pricing/engine';
import { formatCurrency, formatCurrencyPrecise } from '@/lib/pricing/engine';
import type { LongTermComparison } from '@/lib/marketing';

export interface ProposalData {
  proposalNumber: string;
  company: Company;
  customer: Customer;
  property: Property;
  quote: Quote;
  pricing: PricingResult;
  renderedImageUrl: string | null;
  adderLabels: string[];
  financeProgramName: string | null;
  salesRepName: string;
  salesRepEmail: string;
  salesRepPhone: string | null;
  issuedAt: string;
  marketing: CompanyMarketingConfig;
  comparison: LongTermComparison;
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
 * rendering dependency on the server. Every marketing statistic keeps its
 * source and disclaimer inline in this stored copy, not just on the live
 * presentation screen.
 */
export function renderProposalHtml(data: ProposalData): string {
  const { company, customer, property, quote, pricing, marketing, comparison } = data;
  const primary = color(company.brand_primary, '#7C3AED');
  const secondary = color(company.brand_secondary, '#170F26');
  const accent = color(company.brand_accent, '#E0299B');

  const adderRows = pricing.adderLines
    .map(
      (line) => `
        <tr>
          <td>${esc(line.label)}${line.detail ? `<span class="detail">${esc(line.detail)}</span>` : ''}</td>
          <td class="num">${esc(formatCurrencyPrecise(line.amount))}</td>
        </tr>`,
    )
    .join('');

  const features = data.adderLabels.length > 0 ? data.adderLabels : ['Standard LumaGlow permanent lighting system'];

  const benefits = marketing.benefits
    .slice(0, 6)
    .map(
      (b) => `<div class="benefit"><strong>${esc(b.title)}</strong><span>${esc(b.body)}</span></div>`,
    )
    .join('');

  const maxBar = Math.max(comparison.projectedAlternativeCost, comparison.lumaGlowPrice, 1);
  const altPct = Math.max(4, Math.round((comparison.projectedAlternativeCost / maxBar) * 100));
  const lumaPct = Math.max(4, Math.round((comparison.lumaGlowPrice / maxBar) * 100));

  const valueCards = `
    ${
      comparison.enabled
        ? `<div class="vcard">
             <p class="veyebrow">Long-Term Value</p>
             <p class="vtitle">Buy it once. Enjoy it for years.</p>
             <p class="vsub">${esc(comparison.horizonYears)}-Year Illustrative Cost</p>
             <div class="bar-row">
               <div class="bar-label"><span>${esc(comparison.alternativeName)} × ${esc(comparison.numberOfInstallations)}</span><strong>${esc(formatCurrency(comparison.projectedAlternativeCost))}</strong></div>
               <div class="bar-track"><div class="bar-fill muted" style="width:${altPct}%"></div></div>
             </div>
             <div class="bar-row">
               <div class="bar-label"><span>LumaGlow — Installed Once</span><strong>${esc(formatCurrency(comparison.lumaGlowPrice))}</strong></div>
               <div class="bar-track"><div class="bar-fill accent" style="width:${lumaPct}%"></div></div>
             </div>
             <p class="vresult ${comparison.lumaGlowProjectsCheaper ? 'ok' : ''}">
               ${comparison.lumaGlowProjectsCheaper ? 'Potential projected difference' : 'Projected cost difference'}:
               <strong>${esc(formatCurrency(Math.abs(comparison.difference)))}</strong>
             </p>
             <p class="vfoot">${esc(comparison.disclaimer)}</p>
           </div>`
        : ''
    }
    ${
      marketing.show_resale_stat
        ? `<div class="vcard">
             <p class="veyebrow">Resale Appeal</p>
             <p class="vtitle">Curb appeal that can pay you back.</p>
             <p class="vstat">${esc(marketing.resale_headline)}</p>
             <p class="vstatlabel">${esc(marketing.resale_label)}</p>
             <p class="vbody">${esc(marketing.resale_body)}</p>
             <p class="vfoot">${esc(marketing.resale_disclaimer)}</p>
           </div>`
        : ''
    }
    ${
      marketing.show_security_stat
        ? `<div class="vcard">
             <p class="veyebrow">Security / Visibility</p>
             <p class="vtitle">More visibility. Less opportunity.</p>
             <p class="vstat">${esc(marketing.security_headline)}</p>
             <p class="vbody">${esc(marketing.security_body)}</p>
             <p class="vbody"><strong>${esc(marketing.security_secondary_line)}</strong></p>
             <p class="vfoot">${esc(marketing.security_disclaimer)}</p>
           </div>`
        : ''
    }
  `;

  const researchLines = [
    comparison.enabled
      ? `Long-term comparison assumes ${esc(comparison.alternativeName)} at ${esc(formatCurrency(comparison.alternativeInstalledCost))} replaced every ${esc(comparison.replacementIntervalYears)} years over a ${esc(comparison.horizonYears)}-year horizon. ${esc(comparison.disclaimer)}`
      : null,
    marketing.show_resale_stat ? `Resale: ${esc(marketing.resale_source)} ${esc(marketing.resale_disclaimer)}` : null,
    marketing.show_secondary_resale_stat
      ? `${esc(marketing.secondary_resale_source)} ${esc(marketing.secondary_resale_disclaimer)}`
      : null,
    marketing.show_security_stat
      ? `Security: ${esc(marketing.security_source)} ${esc(marketing.security_disclaimer)}`
      : null,
  ].filter(Boolean);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Proposal ${esc(data.proposalNumber)} — ${esc(company.name)}</title>
<style>
  :root { --primary: ${esc(primary)}; --secondary: ${esc(secondary)}; --accent: ${esc(accent)}; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #f4f5f7; color: #0b0f19;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .sheet { max-width: 820px; margin: 0 auto; background: #fff; }
  .head { background: linear-gradient(135deg, var(--primary), var(--secondary)); color: #fff; padding: 28px 32px;
          display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .head img { max-height: 46px; max-width: 190px; object-fit: contain; }
  .head .brand { font-size: 21px; font-weight: 700; letter-spacing: -0.01em; }
  .head .meta { text-align: right; font-size: 12px; line-height: 1.6; opacity: 0.8; }
  .hero img { display: block; width: 100%; height: auto; max-height: 460px; object-fit: cover; }
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

  /* Investment headline */
  .invest { text-align: center; border-radius: 20px; padding: 26px; margin-top: 12px;
            background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 8%, #fff), color-mix(in srgb, var(--accent) 6%, #fff));
            border: 1px solid #e4e7ec; }
  .invest-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; max-width: 460px; margin: 0 auto 18px; }
  .invest-row div span { display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
                          text-transform: uppercase; color: #667085; }
  .invest-row div strong { display: block; margin-top: 4px; font-size: 17px; }
  .invest-row .strike strong { color: #98a2b3; text-decoration: line-through; }
  .invest-row .save strong { color: #0e9f6e; }
  .invest .total-label { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #667085; }
  .invest .total-value { font-size: 44px; font-weight: 800; letter-spacing: -0.02em; margin-top: 4px;
                          background: linear-gradient(135deg, var(--accent), var(--primary));
                          -webkit-background-clip: text; background-clip: text; color: transparent; }

  table { width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 18px; }
  td { padding: 11px 0; border-bottom: 1px solid #eaecf0; vertical-align: top; }
  td.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .detail { display: block; font-size: 12px; color: #667085; margin-top: 2px; }
  tr.total td { border-bottom: none; border-top: 2px solid var(--primary);
                padding-top: 16px; font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
  .finance { margin-top: 16px; border: 1px solid var(--accent); border-radius: 16px;
             padding: 18px 20px; display: flex; justify-content: space-between; align-items: center; }
  .finance strong { font-size: 26px; letter-spacing: -0.02em; }

  /* Value cards */
  .vcards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 16px; }
  .vcard { border: 1px solid #e4e7ec; border-radius: 16px; padding: 18px; background: #fafafb; }
  .veyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); margin: 0; }
  .vtitle { font-size: 14px; font-weight: 700; margin: 4px 0 10px; letter-spacing: -0.01em; }
  .vstat { font-size: 30px; font-weight: 800; margin: 0; letter-spacing: -0.02em;
           background: linear-gradient(135deg, var(--accent), var(--primary)); -webkit-background-clip: text;
           background-clip: text; color: transparent; }
  .vstatlabel { font-size: 12px; font-weight: 600; color: #344054; margin: 2px 0 8px; }
  .vbody { font-size: 12px; line-height: 1.6; color: #475467; margin: 6px 0; }
  .vfoot { font-size: 10px; line-height: 1.6; color: #98a2b3; margin-top: 10px; }
  .vsub { font-size: 11px; color: #667085; margin: 0 0 10px; }
  .bar-row { margin-bottom: 10px; }
  .bar-label { display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #475467; margin-bottom: 4px; }
  .bar-track { height: 9px; border-radius: 6px; background: #eaecf0; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 6px; }
  .bar-fill.muted { background: #98a2b3; }
  .bar-fill.accent { background: linear-gradient(90deg, var(--primary), var(--accent)); }
  .vresult { font-size: 12px; color: #475467; margin-top: 8px; }
  .vresult strong { font-size: 16px; }
  .vresult.ok strong { color: #0e9f6e; }

  .benefits { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px; }
  .benefit { border: 1px solid #e4e7ec; border-radius: 14px; padding: 12px; }
  .benefit strong { display: block; font-size: 13px; margin-bottom: 3px; }
  .benefit span { font-size: 11px; color: #667085; line-height: 1.5; }

  .research { margin-top: 14px; font-size: 10px; line-height: 1.7; color: #98a2b3;
              border-top: 1px solid #eaecf0; padding-top: 12px; }

  .warranty { margin-top: 12px; font-size: 14px; line-height: 1.75; color: #344054; }
  .sign { margin-top: 34px; border-top: 1px solid #e4e7ec; padding-top: 22px;
          display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
  .sign div { border-bottom: 1px solid #98a2b3; padding-bottom: 34px; font-size: 11px;
              letter-spacing: 0.1em; text-transform: uppercase; color: #667085; }
  .foot { padding: 20px 32px 34px; font-size: 11px; line-height: 1.7; color: #98a2b3; }
  @media print { body { background: #fff; } .sheet { max-width: none; } }
  @media (max-width: 640px) { .vcards, .benefits { grid-template-columns: 1fr; } .invest-row { grid-template-columns: repeat(3,1fr); } }
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

  ${data.renderedImageUrl ? `<div class="hero"><img src="${esc(data.renderedImageUrl)}" alt="Your custom LumaGlow design" /></div>` : ''}

  <div class="body">
    <h2>Prepared for</h2>
    <p class="to">${esc(`${customer.first_name} ${customer.last_name}`)}</p>
    <p>${esc([property.address_line1, `${property.city}, ${property.state} ${property.zip}`].join(' · '))}</p>

    <h2>System design</h2>
    <div class="metrics">
      <div class="metric"><span>Linear feet</span><strong>${esc(Number(quote.linear_feet))}</strong></div>
      <div class="metric"><span>Track color</span><strong>${esc(quote.track_color ?? '—')}</strong></div>
      <div class="metric"><span>Key features</span><strong style="font-size:13px">${esc(features.join(', '))}</strong></div>
    </div>

    <h2>Your investment</h2>
    <div class="invest">
      ${
        pricing.retailComparison.enabled
          ? `<div class="invest-row">
               <div class="strike"><span>${esc(pricing.retailComparison.retailLabel)}</span><strong>${esc(formatCurrency(pricing.retailComparison.retailValue))}</strong></div>
               <div><span>${esc(pricing.retailComparison.sellingPriceLabel)}</span><strong>${esc(formatCurrency(pricing.retailComparison.standardValue))}</strong></div>
               <div class="save"><span>${esc(pricing.retailComparison.savingsLabel)}</span><strong>${esc(formatCurrency(Math.max(0, pricing.retailComparison.savings)))}</strong></div>
             </div>`
          : ''
      }
      <p class="total-label">${quote.financing_selected ? 'Estimated monthly payment' : 'Total cash price'}</p>
      <p class="total-value">${
        quote.financing_selected && pricing.monthlyPayment > 0
          ? esc(formatCurrency(pricing.monthlyPayment, { maximumFractionDigits: 0 })) + '/mo'
          : esc(formatCurrency(pricing.total))
      }</p>
      ${quote.financing_selected && data.financeProgramName ? `<p style="font-size:12px;color:#667085;margin-top:4px">${esc(data.financeProgramName)}</p>` : ''}
    </div>

    <details>
      <summary style="cursor:pointer;font-size:12px;color:#667085;margin-top:14px">Itemized pricing detail</summary>
      <table>
        <tr>
          <td>${esc(Number(quote.linear_feet))} linear feet of permanent lighting
            <span class="detail">${esc(formatCurrencyPrecise(pricing.effectivePricePerFoot))} per foot</span></td>
          <td class="num">${esc(formatCurrencyPrecise(pricing.footageSubtotal))}</td>
        </tr>
        ${adderRows}
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
          ? `<p style="font-size:11px;color:#98a2b3;margin-top:10px">
               Payment shown is an estimate based on the selected program and is subject to lender approval.
             </p>`
          : ''
      }
    </details>

    <h2>The value of going permanent</h2>
    <div class="vcards">${valueCards}</div>

    ${
      benefits
        ? `<h2>Why LumaGlow</h2><div class="benefits">${benefits}</div>`
        : ''
    }

    <h2>Warranty</h2>
    <p class="warranty">${esc(company.warranty_copy)}</p>

    ${researchLines.length > 0 ? `<div class="research"><strong>Research &amp; assumptions:</strong> ${researchLines.join(' ')}</div>` : ''}

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
