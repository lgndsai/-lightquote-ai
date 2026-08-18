# Phase 1 — Connecting to a live Supabase project

This session has no Supabase credentials and no network path to create a
project on your behalf, so this phase is a walkthrough for you to run. Steps
1–2 are one-time setup in the Supabase dashboard; steps 3–8 are commands and
checks you run once you have a project.

## 1. Create the project

1. Go to `https://supabase.com/dashboard` and create a new project (or use an
   existing one dedicated to LumaGlow — **do not reuse a project that holds
   another app's data**).
2. Pick a region close to your reps (US regions for a US-based lighting
   company). Note the database password somewhere safe — you won't need it
   for the app, only for direct `psql` access if you ever want it.
3. Wait for provisioning to finish (a couple of minutes).

## 2. Environment variables — exactly where each one comes from

Copy `.env.example` to `.env.local` and fill in:

| Variable | Where to get it | Exposed to browser? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → **Project URL** | Yes — safe |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → **Project API keys** → `anon` `public` | Yes — safe, RLS is the real boundary |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → **Project API keys** → `service_role` | **No — never.** Server-only; used by exactly two code paths (the n8n callback route and admin user invitations) |
| `NEXT_PUBLIC_APP_URL` | Your deployed URL (e.g. `https://app.lumaglow.com`), or `http://localhost:3000` in dev | Yes |
| `N8N_VISUALIZATION_WEBHOOK_URL` | The production webhook URL of your n8n "generate visualization" workflow | No |
| `N8N_DEAL_SOLD_WEBHOOK_URL` | n8n webhook URL for the deal-sold workflow | No |
| `N8N_DEAL_INSTALLED_WEBHOOK_URL` | n8n webhook URL for the deal-installed workflow | No |
| `N8N_WEBHOOK_SECRET` | Generate with `openssl rand -hex 32`; paste the same value into your n8n workflow's expected header check | No |
| `N8N_CALLBACK_SECRET` | Generate with `openssl rand -hex 32`; paste the same value into the n8n node that calls back into `/api/webhooks/n8n/design-complete` | No |

Never put `SUPABASE_SERVICE_ROLE_KEY` in anything prefixed `NEXT_PUBLIC_` —
that prefix is what tells Next.js to bundle a variable into client-side
JavaScript. The codebase enforces this at the type level
(`src/lib/supabase/admin.ts` imports `server-only`, which is a build error if
ever imported from a Client Component), but the discipline starts with the
env file.

**Deploying?** Set the same variables in your host's environment (Vercel
Project Settings → Environment Variables, or your platform's equivalent) —
never commit `.env.local`.

## 3. Apply the migrations

From the repo root, with the Supabase CLI (`npx supabase --version` works
without a global install):

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>   # found in the project URL
npx supabase db push
```

This applies every file in `supabase/migrations/` in order:

1. `0001_init.sql` — all 12 tables, FKs, indexes, triggers
2. `0002_rls.sql` — RLS policies and the SECURITY DEFINER helpers
3. `0003_storage.sql` — buckets (all private except `branding`) + storage RLS
4. `0004_bootstrap.sql` — the `handle_new_user` signup trigger + default seed data
5. `0005_realtime.sql` — realtime on `designs`
6. `0006_branding.sql` — brand_secondary column + LumaGlow-default brand colors
7. `0007_lumaglow_pricing.sql` — retail/standard pricing fields + the real LumaGlow adder/finance seed
8. `0008_marketing_claims.sql` — configurable "Value of Going Permanent" copy and statistics

If you'd rather paste SQL directly: open the Supabase SQL Editor and run each
file's contents in the order above. `db push` is safer — it tracks what's
already applied.

## 4–6. Verify signup, provisioning and seeded data

```bash
npm run dev
```

Visit `/signup`, create an account with a company name. Then check, either in
the Supabase Table Editor or via SQL Editor:

```sql
-- one company, one admin user, both freshly created
select id, name, brand_primary, brand_accent from companies order by created_at desc limit 1;
select id, email, role, company_id from users order by created_at desc limit 1;

-- pricing seeded for that company
select suggested_price_per_foot, min_price_per_foot, retail_price_per_ft,
       standard_price_per_ft, show_retail_comparison
from company_pricing where company_id = '<the company id above>';

-- the six default adders, all editable, none hardcoded in the app
select kind, name, unit, price, is_active
from company_catalog_items
where company_id = '<the company id above>'
order by kind, sort_order;

-- three finance programs
select name, term_months, apr, payment_factor from finance_programs
where company_id = '<the company id above>';
```

You should see: a `sales_rep` role of `admin` on the new user, retail/standard
per-foot pricing populated, and the adders Small System Fee, Double Track,
Custom Painted Channel, Travel, Lift Rental and Other.

## 7. Verify storage

```sql
select id, public from storage.buckets order by id;
```

Expect: `branding` → `public = true`; `property-photos`, `renders`,
`proposals` → `public = false`.

Then in the app: create a quote, upload a property photo, and confirm it
renders on the photo review screen. Under the hood this is now a signed URL
(`?token=...` in the address, if you inspect the `<img>` src) — a public
`storage/v1/object/public/...` URL for the same file will now 400.

## 8. Verify Row Level Security

```sql
-- RLS is enabled everywhere
select relname, relrowsecurity from pg_class
where relname in ('companies','users','customers','properties','designs',
                   'quotes','quote_adders','company_pricing',
                   'company_catalog_items','finance_programs','proposals','projects')
and relrowsecurity = false;
-- expect zero rows back
```

### Tenant isolation — do this before any real homeowner data goes in

1. Sign up **twice**, with two different company names, in two browser
   profiles (or one normal + one incognito window) — this gives you Company A
   admin and Company B admin.
2. As Company A: create a customer, a property, upload a photo, create a
   quote.
3. As Company B: confirm the dashboard shows **zero** quotes, and that
   navigating directly to Company A's quote URL
   (`/quotes/<company-a-quote-id>`) 404s rather than showing data.
4. As Company B, try reading Company A's photo path directly:
   ```ts
   // paste into the browser console while signed in as Company B
   await window.supabase.storage.from('property-photos').createSignedUrl('<company-a-uuid>/<quote-id>/original-....jpg', 60)
   ```
   Expect an error (`Object not found` / permission denied) — the storage
   RLS policy checks the first path segment against `current_company_id()`.
5. Confirm Company B cannot see Company A's `company_pricing` or
   `company_catalog_items` rows via the Table Editor's RLS-aware "as user"
   view, or by querying with Company B's anon-key session.

If any of these leak data, stop and fix RLS before entering real homeowner
information — this is exactly the check the task specifies.

## Anonymous access check (the actual security change in this phase)

With signup/RLS verified, confirm the fix that matters most: grab any
`property-photos` or `renders` object path from the database and try it
**signed out**:

```
https://<project-ref>.supabase.co/storage/v1/object/public/property-photos/<path>
```

This must now return `404`/`"Bucket not found"` or a permission error — before
this phase it would have served the image to anyone on the internet. This is
the check that proves the private-bucket change actually took effect.
