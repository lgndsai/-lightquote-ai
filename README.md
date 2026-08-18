# LumaGlow

A mobile-first web app for permanent exterior lighting sales reps. The whole
flow — customer → property photo → lighting visualization → footage → price →
proposal → sale — is designed to run in under five minutes while sitting with a
homeowner.

Built with Next.js (App Router), TypeScript, React, Tailwind CSS, Supabase
(Postgres, Auth, Storage) and n8n webhooks for the AI automation.

## Getting started

```bash
npm install
cp .env.example .env.local     # fill in your Supabase project values
npm run dev
```

Apply the migrations in `supabase/migrations/` in order, either through the
Supabase SQL editor or `supabase db push`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Pricing engine unit tests |

## Architecture

### Multi-tenancy

Every business record carries `company_id`, and Row Level Security is the
security boundary — not application code. Policies lean on four
`SECURITY DEFINER` helpers so that a policy on `users` never has to read
`users` through RLS (which would recurse):

- `current_company_id()` / `current_app_role()` — the caller's tenant and role
- `can_read_record(company_id, owner)` / `can_write_record(...)` — owned rows
- `can_read_quote(quote_id)` / `can_write_quote(quote_id)` — child rows inherit
  their quote's access

Roles:

| Role | Access |
| --- | --- |
| `admin` | Everything in their company, including pricing and users |
| `manager` | Reads every company quote, writes their own |
| `sales_rep` | Only records they created |

Server and browser Supabase clients both use the **anon key**, so RLS applies
even in Server Components. The service-role client (`src/lib/supabase/admin.ts`)
is guarded by `import 'server-only'` and is used in exactly two places: the n8n
callback route (which has no user session) and admin user invitations.

### Storage

| Bucket | Read | Contents |
| --- | --- | --- |
| `property-photos` | **private** | Original and marked photographs |
| `renders` | **private** | AI-rendered visualizations |
| `proposals` | **private** | Generated proposal documents |
| `branding` | public | Company logos only (need to render on the signed-out login screen) |

Every private-bucket read is a signed URL minted at request time
(`src/lib/storage.ts`) from a caller who has already passed RLS on
`storage.objects` — nothing is reachable by a bare URL. `*_url` database
columns are never trusted as the source of truth; they're always regenerated
from the corresponding `*_path` column (`getQuoteContext` for server reads,
`supabase.storage.from(bucket).createSignedUrl()` client-side for the
realtime-polled generating/visualization screens). Writes on every bucket are
restricted by RLS to objects under the caller's own `company_id/` prefix.

### Pricing

`src/lib/pricing/engine.ts` is a pure function of company configuration. No
component contains a price. `standard_price_per_ft` is the single per-foot
rate every quote is calculated from — the rep quoting screen (linear feet,
track color, one "add optional adder" picker, cash/finance) never asks for a
price. `retail_price_per_ft` drives a separate, footage-only comparison stat
(never adders/tax/dealer fee) shown as Retail Value / LumaGlow Price /
Savings — admin can relabel or disable it.

Selections travel from the browser as footage, track color, selected adder
ids/quantities and a finance program id — never a price. Totals are
recomputed server-side in `saveQuotePricing`, so a tampered client cannot move
a number on a contract. Once a quote is saved, its rate is locked
(`quote.price_per_foot`); re-displaying that quote later
(`pinPricingToQuote()`) always recomputes from the locked rate, never from
whatever the company's live pricing config says at view time — otherwise an
admin changing prices between "measure" and "present" would make the retail
comparison drift from the actual charged total.

Admins configure retail/standard price per foot, tax rate and labor
treatment, dealer fees, minimum job price, adders (flat / per-foot /
percentage / quantity, each enable-able, renameable and re-priceable) and
track colors — see `/admin/pricing` and `/admin/catalog`.

### Marketing / proposal value

`company_marketing_config` (`src/lib/marketing.ts`, `/admin/marketing`) holds
every statistic, source and disclaimer shown in "The Value of Going
Permanent": the long-term cost comparison assumptions (alternative name,
installed cost, replacement interval, comparison horizon — all editable, none
hardcoded), the resale statistic (with an optional secondary one, off by
default), the security/visibility statistic, and up to 6 "Why LumaGlow"
benefit cards. `calculateLongTermComparison()` is the only place that number
is computed — `ceil(horizon / interval) × installed_cost` projected against
the homeowner's actual LumaGlow price — and it never manufactures a positive
"savings" figure: if LumaGlow costs more over the horizon, the UI labels it
"Projected Cost Difference," not a benefit.

### Roofline tracing

Strokes are stored as **normalized 0..1 coordinates** relative to the photo's
own box, so a path traced on an iPhone lands identically on an iPad, on the
full-resolution marked export and in the n8n payload.

## n8n integration

Configure the three webhook URLs and two secrets in `.env.local`.

### `generate-visualization` (outbound)

`POST /api/generate-visualization` creates or clones a design record and calls
your n8n workflow. The payload is built from the stored design row, never from
the browser:

```json
{
  "design_id": "uuid",
  "quote_id": "uuid",
  "company_id": "uuid",
  "original_image_url": "https://…?token=…",
  "marked_image_url": "https://…?token=…",
  "roofline_coordinates": [{ "points": [{ "x": 0.21, "y": 0.44 }], "width": 0.006 }],
  "lighting_style": "warm_white",
  "preset": null,
  "callback_url": "https://your-app/api/webhooks/n8n/design-complete",
  "callback_secret": "…"
}
```

`original_image_url` / `marked_image_url` are **signed URLs** (1-hour expiry,
minted server-side) — `property-photos` is a private bucket, so n8n must fetch
the image within that window. Requests carry `x-lightquote-secret` so the
workflow can verify the caller.

**n8n must upload the finished render itself.** `renders` is also private, so
the workflow needs its own Supabase credential (the project's service-role
key, held only in n8n's own credential store — never in this app's env) to
`POST /storage/v1/object/renders/{company_id}/{quote_id}/render-<uuid>.jpg`,
then report back the **path**, not a URL.

### `design-complete` (inbound)

When the render finishes, n8n posts back with `x-callback-secret` (compared in
constant time):

```json
{
  "design_id": "uuid",
  "status": "complete",
  "rendered_image_path": "{company_id}/{quote_id}/render-<uuid>.jpg",
  "error_message": null
}
```

The app stores the path; every screen mints its own signed URL from it at
display time — the app never trusts a URL from n8n directly, only a path
inside its own bucket. The generating screen picks the status change up over
Supabase Realtime, with polling as a fallback for unreliable in-home Wi-Fi.

### `deal-sold` and `deal-installed` (outbound)

Fired when a homeowner accepts a proposal and when a project is marked
installed. Both are best-effort — a failing automation never blocks a signature
or a status change.

## Project layout

```
src/app/(auth)/          sign in / sign up
src/app/(app)/           dashboard, quote wizard, projects, admin
  quotes/[id]/           photo → design → generating → visualization →
                         measure → present → proposal
src/app/api/             generate-visualization, n8n callback
src/lib/pricing/         engine + company config loader
src/lib/marketing.ts     value-card copy/statistics loader + long-term cost math
src/lib/storage.ts       signed-URL helpers for the three private buckets
src/lib/canvas.ts        roofline rendering and erase geometry
src/lib/proposal/        proposal document generator
supabase/migrations/     schema, RLS, storage, bootstrap, realtime, LumaGlow
                         pricing/adders (0006-0007), marketing config (0008)
docs/                    live-Supabase connection walkthrough
```

## Design system

`src/app/globals.css` defines the tokens: `paper`/`card`/`line` for the
neutral, usability-first admin screens, and `ink`/`ink-soft`/`ink-line` (a
deep charcoal-purple) plus `.bg-luma-surface` (a violet-to-magenta gradient)
for the customer-facing screens, which are deliberately more premium than the
admin ones. `--brand-primary` / `--brand-secondary` / `--brand-accent` are
CSS variables set per company by `<BrandProvider>` (`companies.brand_*`,
admin-configurable, hex-validated) — they default to LumaGlow's own palette
(`#7C3AED` / `#170F26` / `#E0299B`) both as the `:root` fallback (pre-auth
screens) and as the Postgres column defaults for a newly provisioned company.

## Security notes

- No service-role or API key is ever exposed to the browser.
- RLS is enabled on every table, including the private-bucket check on
  `storage.objects` — company_id is parsed from the object path and compared
  against the caller's own company, so a guessed or leaked path (or a signed
  URL request for it) still resolves to nothing outside the caller's tenant.
- Inbound webhooks authenticate with a shared secret compared in constant time.
- Brand colors are hex-validated before they reach a stylesheet, and every
  value interpolated into the proposal document is HTML-escaped.
- An admin cannot change their own role or deactivate themselves.
- Every marketing statistic ships with its source and disclaimer inline, both
  on the live presentation screen and baked into the stored proposal
  document — nothing here overstates what the cited research shows.
