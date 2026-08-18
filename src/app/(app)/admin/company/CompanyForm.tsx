'use client';

import { useActionState, useState } from 'react';
import type { Company } from '@/lib/types/db';
import { updateCompany, type AdminState } from '../actions';
import { TextField, TextArea, Label } from '@/components/ui/Field';
import { FormMessage, SubmitButton } from '@/components/ui/SubmitBar';
import { Card, SectionTitle } from '@/components/ui/Card';
import { createClient } from '@/lib/supabase/client';
import { compressImage } from '@/lib/images';

export function CompanyForm({ company }: { company: Company }) {
  const [state, action] = useActionState<AdminState, FormData>(updateCompany, {});
  const [logoUrl, setLogoUrl] = useState(company.logo_url ?? '');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadLogo = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const supabase = createClient();
      const isVector = file.type === 'image/svg+xml';
      const body = isVector ? file : await compressImage(file, 600, 0.92);
      const path = `${company.id}/logo-${crypto.randomUUID()}.${isVector ? 'svg' : 'jpg'}`;

      const { error } = await supabase.storage
        .from('branding')
        .upload(path, body, { contentType: isVector ? 'image/svg+xml' : 'image/jpeg', upsert: false });
      if (error) throw new Error(error.message);

      const {
        data: { publicUrl },
      } = supabase.storage.from('branding').getPublicUrl(path);
      setLogoUrl(publicUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Logo upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pt-5 pb-16">
      <h1 className="mb-5 text-[26px] font-semibold tracking-tight text-ink">Company</h1>

      <form action={action} className="space-y-6">
        <Card className="space-y-3">
          <TextField name="name" label="Company name" defaultValue={company.name} required />

          <div>
            <Label hint="Shown on every proposal">Logo</Label>
            <div className="flex items-center gap-3">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-paper">
                {logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={logoUrl} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-xl font-bold text-muted">{company.name.slice(0, 1)}</span>
                )}
              </span>
              <label className="flex min-h-13 flex-1 cursor-pointer items-center justify-center rounded-2xl border border-line bg-card px-4 font-semibold text-ink shadow-sm">
                {uploading ? 'Uploading…' : 'Upload a logo'}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void uploadLogo(file);
                  }}
                />
              </label>
            </div>
            <input type="hidden" name="logo_url" value={logoUrl} />
            {uploadError ? (
              <p className="mt-2 text-[13px] font-medium text-danger">{uploadError}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <ColorField name="brand_primary" label="Primary" defaultValue={company.brand_primary} />
            <ColorField name="brand_secondary" label="Secondary" defaultValue={company.brand_secondary} />
            <ColorField name="brand_accent" label="Accent" defaultValue={company.brand_accent} />
          </div>
          <p className="text-[12px] leading-relaxed text-muted">
            Primary and secondary drive the dark gradient behind customer-facing screens; accent
            highlights buttons, selected states and glow effects. Changes apply everywhere
            immediately — nothing about pricing or branding is hardcoded per screen.
          </p>
        </Card>

        <div>
          <SectionTitle>Contact</SectionTitle>
          <Card className="space-y-3">
            <TextField name="phone" label="Phone" type="tel" inputMode="tel" defaultValue={company.phone ?? ''} />
            <TextField name="email" label="Email" type="email" inputMode="email" autoCapitalize="none" defaultValue={company.email ?? ''} />
            <TextField name="website" label="Website" defaultValue={company.website ?? ''} autoCapitalize="none" />
            <TextField name="address_line1" label="Street address" defaultValue={company.address_line1 ?? ''} />
            <TextField name="city" label="City" defaultValue={company.city ?? ''} />
            <div className="grid grid-cols-2 gap-3">
              <TextField name="state" label="State" maxLength={2} autoCapitalize="characters" defaultValue={company.state ?? ''} />
              <TextField name="zip" label="ZIP" inputMode="numeric" defaultValue={company.zip ?? ''} />
            </div>
            <TextField name="license_number" label="License number" defaultValue={company.license_number ?? ''} />
          </Card>
        </div>

        <div>
          <SectionTitle>Proposal copy</SectionTitle>
          <Card className="space-y-3">
            <TextArea name="warranty_copy" label="Warranty" defaultValue={company.warranty_copy} />
            <TextArea
              name="proposal_benefits"
              label="Included benefits (one per line)"
              defaultValue={(company.proposal_benefits ?? []).join('\n')}
              placeholder={'Professional installation\nColor-matched track\nLifetime LED warranty'}
            />
          </Card>
        </div>

        <FormMessage error={state.error} message={state.message} />
        <SubmitButton />
      </form>
    </main>
  );
}

function ColorField({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <label className="block">
      <Label>{label}</Label>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-13 w-14 shrink-0 cursor-pointer rounded-2xl border border-line bg-card p-1"
          aria-label={`${label} picker`}
        />
        <input
          name={name}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="min-h-13 w-full rounded-2xl border border-line bg-card px-4 text-ink shadow-sm focus:border-[var(--brand-accent)] focus:outline-none"
        />
      </span>
    </label>
  );
}
