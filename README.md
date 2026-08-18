# LightQuote AI

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
| `property-photos` | public | Original and marked photographs |
| `renders` | public | AI-rendered visualizations |
| `branding` | public | Company logos |
| `proposals` | private | Generated proposal documents, served via signed URLs |

Public buckets use unguessable UUID paths so n8n and the customer-facing
screens can load images without a signing round-trip. Writes on every bucket
are restricted by RLS to objects under the caller's own `company_id/` prefix.

### Pricing

`src/lib/pricing/engine.ts` is a pure function of company configuration. No
component contains a price. The engine drives the live preview on the
measurement screen, the three proposal levels, the stored quote totals and the
proposal document — one calculation, four surfaces.

Selections travel from the browser as *ids only*; prices are read from the
company catalog and totals are recomputed in `saveQuotePricing`, so a tampered
client cannot move a number on a contract.

Admins configure suggested and minimum price per foot, controller price, tax
rate and labor treatment, dealer fees, minimum job price, adders, discounts,
track colors, finance programs and the three proposal levels.

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
  "original_image_url": "https://…",
  "marked_image_url": "https://…",
  "roofline_coordinates": [{ "points": [{ "x": 0.21, "y": 0.44 }], "width": 0.006 }],
  "lighting_style": "warm_white",
  "preset": null,
  "callback_url": "https://your-app/api/webhooks/n8n/design-complete",
  "callback_secret": "…"
}
```

Requests carry `x-lightquote-secret` so the workflow can verify the caller.

### `design-complete` (inbound)

When the render finishes, n8n posts back with `x-callback-secret` (compared in
constant time):

```json
{
  "design_id": "uuid",
  "status": "complete",
  "rendered_image_url": "https://…",
  "error_message": null
}
```

The app updates the design row; the generating screen picks the change up over
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
src/lib/canvas.ts        roofline rendering and erase geometry
src/lib/proposal/        proposal document generator
supabase/migrations/     schema, RLS, storage, bootstrap, realtime
```

## Security notes

- No service-role or API key is ever exposed to the browser.
- RLS is enabled on all twelve tables.
- Inbound webhooks authenticate with a shared secret compared in constant time.
- Brand colors are hex-validated before they reach a stylesheet, and every
  value interpolated into the proposal document is HTML-escaped.
- An admin cannot change their own role or deactivate themselves.
