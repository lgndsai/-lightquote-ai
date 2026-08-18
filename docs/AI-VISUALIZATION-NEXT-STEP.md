# Wiring the AI image-generation endpoint

The app's side of the visualization pipeline is complete and tested: photo
capture, roofline tracing, `POST /api/generate-visualization`, the n8n
dispatch, the callback contract, realtime status updates and the before/after
reveal. What's missing is the n8n workflow itself and an image-generation
model behind it — that's this document.

## What the app sends n8n

`POST {N8N_VISUALIZATION_WEBHOOK_URL}` (see `src/lib/n8n.ts`), header
`x-lightquote-secret: {N8N_WEBHOOK_SECRET}`:

```json
{
  "design_id": "uuid",
  "quote_id": "uuid",
  "company_id": "uuid",
  "original_image_url": "https://…?token=…",   // signed, 1-hour expiry
  "marked_image_url": "https://…?token=…",      // the traced roofline overlay, same expiry
  "roofline_coordinates": [{ "points": [{ "x": 0.21, "y": 0.44 }, ...], "width": 0.006 }],
  "lighting_style": "warm_white",                // or holiday / team_colors / security / soft_white
  "preset": null,                                 // or warm_white / christmas / fourth_of_july / game_day
  "callback_url": "https://your-app/api/webhooks/n8n/design-complete",
  "callback_secret": "…"
}
```

`marked_image_url` is the original photo with the traced roofline already
composited on as glowing bulbs (see `src/lib/canvas.ts:drawStrokes`) — this is
the strongest signal for *where* to place lighting, since it's drawn directly
on the homeowner's actual roofline.

## The n8n workflow (minimum viable)

1. **Webhook trigger** — validate `x-lightquote-secret` equals your stored
   secret (reject otherwise; the callback secret in the payload authenticates
   *your* call back to the app, it's not for authenticating the inbound
   request).
2. **Fetch `original_image_url`** (and optionally `marked_image_url` for
   placement guidance).
3. **Call an image-generation model** capable of image-to-image editing that
   preserves the input structure — see the prompt below and model notes.
4. **Upload the result** to Supabase Storage yourself, into the private
   `renders` bucket, using the project's **service-role key** (a credential
   held only in n8n, never in this app's client bundle):
   ```
   POST {SUPABASE_URL}/storage/v1/object/renders/{company_id}/{quote_id}/render-<uuid>.jpg
   Authorization: Bearer {service-role key}
   ```
5. **Call back** `POST {callback_url}` with header
   `x-callback-secret: {callback_secret from the payload}`:
   ```json
   {
     "design_id": "...",
     "status": "complete",
     "rendered_image_path": "{company_id}/{quote_id}/render-<uuid>.jpg"
   }
   ```
   On failure, post `{"design_id": "...", "status": "failed", "error_message": "..."}`
   instead — the app surfaces this with a retry button rather than hanging.

## The prompt — realism over reinterpretation

This is the part that determines whether the render looks like *their* house
or a generic AI house. Use an image-to-image / edit-in-place model (not
text-to-image) so the source photo is the actual constraint, and be explicit
about what must NOT change:

```
Edit this photograph of a house to add professionally installed permanent
architectural lighting along the traced roofline shown in the reference
overlay image. This is a photo edit, not a new scene — preserve the exact
house, roofline, windows, doors, siding, roof material, landscaping,
driveway, walkways, cars, and camera perspective/framing pixel-for-pixel.

Only change:
1. Add a continuous LED light channel/track running along the marked
   roofline, mounted flush to the fascia as a professional installer would.
2. Light color: {LIGHTING_STYLE} — warm white (~2700K), soft white (~3000K),
   holiday reds/greens/whites, team colors, or crisp white security lighting.
3. Adjust ambient lighting to dusk/evening so the installed lighting reads
   clearly, if the source photo was taken in daylight.

Do not add lighting anywhere not marked on the reference overlay. Do not
alter the architecture, add or remove windows/doors, change the roof shape,
regenerate landscaping, or reinterpret the house in a different style. Do not
add people, vehicles, or objects not present in the original photo. The
homeowner must recognize this as their own house with lights added, not a
different or stylized house.
```

Substitute `{LIGHTING_STYLE}` from the payload's `lighting_style`/`preset`
field. If your model supports a reference/control image, pass
`marked_image_url` as the structural/placement reference and
`original_image_url` as the base image to edit.

### Model notes (pick one; none of this is wired into the app — it's entirely n8n-side)

- **Image-to-image editing models** (e.g. a GPT-Image edit endpoint, or
  Gemini's image editing models) generally hold structure best when given the
  original photo directly and an edit instruction — closest fit to the
  "preserve everything, add one thing" requirement above.
- **ControlNet-style pipelines** (e.g. Stable Diffusion + a roofline mask/edge
  ControlNet) give the most precise control over *where* the light channel
  goes, using the marked overlay's roofline as the control image, at the cost
  of more workflow complexity to stand up.
- Whichever you choose, test on 3-5 real house photos across roof shapes
  (single story, two story, dormers, complex rooflines) before trusting it in
  front of a homeowner — the "preserve architecture" instruction needs
  validation per-model, since some editing models still drift the source
  image more than others.

## Environment variables this needs (see `.env.example` / `docs/PHASE1-LIVE-SUPABASE.md`)

- `N8N_VISUALIZATION_WEBHOOK_URL` — your n8n webhook's public URL
- `N8N_WEBHOOK_SECRET` — shared secret this app sends, that n8n checks
- `N8N_CALLBACK_SECRET` — shared secret n8n sends back, that this app checks
- In n8n itself (not in this app's env): the Supabase service-role key for
  the `renders` upload, and whichever image-generation API key your chosen
  model needs.

## The exact next step

1. Stand up the n8n workflow above (webhook → fetch → generate → upload →
   callback) against a real image-generation API key.
2. Set the three env vars above pointing at it.
3. From the app, run one real quote through photo → trace → **GENERATE
   PREVIEW** and watch the generating screen resolve to a real render.
4. Compare against 4-5 more houses with different rooflines before it's in
   front of a homeowner, tightening the prompt/model choice as needed.

Nothing else in the app blocks on this — every other phase (branding,
pricing, value presentation, proposal, acceptance, projects) works end to end
today; this is the one external integration this session could not wire up
because it requires a live n8n instance and an image-generation API key,
neither of which exist in this environment.
