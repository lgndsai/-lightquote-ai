'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Customer, Design, Project, ProjectStatus, Property, Quote } from '@/lib/types/db';
import { updateProjectStatus } from '../actions';
import { Button } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';
import { TextArea } from '@/components/ui/Field';
import { formatCurrency } from '@/lib/pricing/engine';
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_STYLE,
  addressLine,
  customerName,
  formatDate,
  formatPhone,
} from '@/lib/format';

const FLOW: ProjectStatus[] = ['sold', 'scheduled', 'installed'];

interface Props {
  project: Project;
  customer: Customer | null;
  property: Property | null;
  quote: Quote | null;
  design: Design | null;
  canEdit: boolean;
}

export function ProjectDetail({ project, customer, property, quote, design, canEdit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(project.install_notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const setStatus = useCallback(
    (status: ProjectStatus) => {
      setError(null);
      startTransition(async () => {
        const result = await updateProjectStatus({
          project_id: project.id,
          status,
          install_notes: notes || null,
        });
        if (result.error) setError(result.error);
        else router.refresh();
      });
    },
    [notes, project.id, router],
  );

  const currentIndex = FLOW.indexOf(project.status);
  const cancelled = project.status === 'cancelled';

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 pt-5 pb-16">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-ink">
              {customerName(customer)}
            </h1>
            <p className="mt-1 text-[14px] text-muted">{addressLine(property)}</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
              PROJECT_STATUS_STYLE[project.status]
            }`}
          >
            {PROJECT_STATUS_LABEL[project.status]}
          </span>
        </div>
      </div>

      {design?.rendered_image_url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={design.rendered_image_url}
          alt="Approved design"
          className="w-full rounded-3xl object-cover shadow-sm"
        />
      ) : null}

      {/* Install pipeline */}
      {!cancelled ? (
        <div className="flex items-center gap-1.5">
          {FLOW.map((step, index) => (
            <div key={step} className="flex flex-1 flex-col gap-1.5">
              <span
                className={`h-1.5 rounded-full ${index <= currentIndex ? 'bg-ok' : 'bg-line'}`}
              />
              <span
                className={`text-[11px] font-bold uppercase tracking-wide ${
                  index <= currentIndex ? 'text-ink' : 'text-muted'
                }`}
              >
                {PROJECT_STATUS_LABEL[step]}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <Card className="space-y-3">
        <Row label="Contract value" value={formatCurrency(Number(project.contract_value))} />
        {quote ? <Row label="Quote" value={quote.quote_number} /> : null}
        {quote && Number(quote.linear_feet) > 0 ? (
          <Row label="Linear feet" value={String(Number(quote.linear_feet))} />
        ) : null}
        {quote?.track_color ? <Row label="Track" value={quote.track_color} /> : null}
        {quote?.controller_name ? <Row label="Controller" value={quote.controller_name} /> : null}
        <Row label="Sold" value={formatDate(project.sold_at)} />
        {project.scheduled_at ? <Row label="Scheduled" value={formatDate(project.scheduled_at)} /> : null}
        {project.installed_at ? <Row label="Installed" value={formatDate(project.installed_at)} /> : null}
      </Card>

      {customer && (customer.phone || customer.email) ? (
        <div>
          <SectionTitle>Contact</SectionTitle>
          <div className="space-y-2">
            {customer.phone ? (
              <a
                href={`tel:${customer.phone}`}
                className="flex min-h-14 items-center justify-between rounded-2xl border border-line bg-card px-5 font-semibold text-ink shadow-sm"
              >
                {formatPhone(customer.phone)}
                <span aria-hidden className="text-muted">Call</span>
              </a>
            ) : null}
            {customer.email ? (
              <a
                href={`mailto:${customer.email}`}
                className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-line bg-card px-5 font-semibold text-ink shadow-sm"
              >
                <span className="truncate">{customer.email}</span>
                <span aria-hidden className="shrink-0 text-muted">Email</span>
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {canEdit ? (
        <div>
          <SectionTitle>Install status</SectionTitle>
          <TextArea
            label="Install notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Crew, access notes, materials…"
          />

          <div className="mt-3 space-y-2">
            {project.status === 'sold' ? (
              <Button variant="primary" size="lg" fullWidth onClick={() => setStatus('scheduled')} disabled={pending}>
                Mark scheduled
              </Button>
            ) : null}
            {(project.status === 'sold' || project.status === 'scheduled') ? (
              <Button variant="accent" size="lg" fullWidth onClick={() => setStatus('installed')} disabled={pending}>
                Mark installed
              </Button>
            ) : null}
            {project.status === 'installed' ? (
              <Button variant="secondary" size="lg" fullWidth onClick={() => setStatus('scheduled')} disabled={pending}>
                Reopen as scheduled
              </Button>
            ) : null}
            {!cancelled ? (
              <Button variant="secondary" size="lg" fullWidth onClick={() => setStatus('cancelled')} disabled={pending} className="text-danger">
                Cancel project
              </Button>
            ) : (
              <Button variant="secondary" size="lg" fullWidth onClick={() => setStatus('sold')} disabled={pending}>
                Reinstate project
              </Button>
            )}
          </div>

          {error ? (
            <p role="alert" className="mt-3 rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      <Link
        href={`/quotes/${project.quote_id}/proposal`}
        className="flex min-h-14 items-center justify-center rounded-2xl border border-line bg-card font-semibold text-ink shadow-sm"
      >
        View the proposal
      </Link>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3 last:border-0 last:pb-0">
      <span className="text-[13px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <span className="text-right text-[15px] font-medium text-ink">{value}</span>
    </div>
  );
}
