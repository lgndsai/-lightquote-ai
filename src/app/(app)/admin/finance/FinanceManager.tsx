'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { FinanceProgram } from '@/lib/types/db';
import { deleteFinanceProgram, saveFinanceProgram, type AdminState } from '../actions';
import { TextField } from '@/components/ui/Field';
import { FormMessage, SubmitButton } from '@/components/ui/SubmitBar';
import { Button } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';
import { formatCurrency, monthlyPayment } from '@/lib/pricing/engine';

export function FinanceManager({ programs }: { programs: FinanceProgram[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<FinanceProgram | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  const remove = (id: string) => {
    startTransition(async () => {
      await deleteFinanceProgram(id);
      router.refresh();
    });
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pt-5 pb-16">
      <h1 className="mb-1 text-[26px] font-semibold tracking-tight text-ink">Finance programs</h1>
      <p className="mb-5 text-[15px] text-muted">
        A payment factor is the monthly payment per $1,000 financed. When set it wins over the APR.
      </p>

      {editing || creating ? (
        <ProgramForm
          key={editing?.id ?? 'new'}
          program={editing}
          onDone={() => {
            setEditing(null);
            setCreating(false);
            router.refresh();
          }}
        />
      ) : (
        <>
          <div className="space-y-2">
            {programs.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
                No programs yet.
              </p>
            ) : (
              programs.map((program) => (
                <div
                  key={program.id}
                  className={`rounded-2xl border p-4 ${
                    program.is_active ? 'border-line bg-card' : 'border-line/60 bg-card/60 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[16px] font-semibold text-ink">{program.name}</p>
                      <p className="mt-0.5 text-[13px] text-muted">
                        {program.term_months} months
                        {Number(program.payment_factor) > 0
                          ? ` · factor ${Number(program.payment_factor)}`
                          : ` · ${(Number(program.apr) * 100).toFixed(2)}% APR`}
                        {' · '}dealer fee {(Number(program.dealer_fee_percent) * 100).toFixed(1)}%
                        {program.is_active ? '' : ' · hidden'}
                      </p>
                      <p className="mt-1 text-[13px] font-semibold text-muted">
                        {formatCurrency(monthlyPayment(10000, program))}/mo on a{' '}
                        {formatCurrency(10000)} job
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="secondary" size="md" onClick={() => setEditing(program)}>
                        Edit
                      </Button>
                      {program.is_active ? (
                        <Button
                          variant="secondary"
                          size="md"
                          className="text-danger"
                          disabled={pending}
                          onClick={() => remove(program.id)}
                        >
                          Hide
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4">
            <Button variant="primary" size="lg" fullWidth onClick={() => setCreating(true)}>
              Add a program
            </Button>
          </div>
        </>
      )}
    </main>
  );
}

function ProgramForm({ program, onDone }: { program: FinanceProgram | null; onDone: () => void }) {
  const [state, action] = useActionState<AdminState, FormData>(async (prev, formData) => {
    const result = await saveFinanceProgram(prev, formData);
    if (result.ok) onDone();
    return result;
  }, {});

  return (
    <form action={action} className="space-y-4">
      <SectionTitle>{program ? 'Edit program' : 'New program'}</SectionTitle>
      <Card className="space-y-3">
        <input type="hidden" name="id" value={program?.id ?? ''} />
        <TextField name="name" label="Name" defaultValue={program?.name ?? ''} required />
        <TextField name="provider" label="Lender" defaultValue={program?.provider ?? ''} />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            name="term_months"
            label="Term (months)"
            type="number"
            inputMode="numeric"
            defaultValue={String(program?.term_months ?? 120)}
            required
          />
          <TextField
            name="apr"
            label="APR"
            type="number"
            step="0.0001"
            inputMode="decimal"
            defaultValue={String(program?.apr ?? 0.0999)}
            hint="0.0999 = 9.99%"
          />
        </div>
        <TextField
          name="payment_factor"
          label="Payment factor"
          type="number"
          step="0.0001"
          inputMode="decimal"
          defaultValue={String(program?.payment_factor ?? 0)}
          hint="per $1,000 — 0 to use APR"
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            name="dealer_fee_percent"
            label="Dealer fee"
            type="number"
            step="0.0001"
            inputMode="decimal"
            defaultValue={String(program?.dealer_fee_percent ?? 0)}
            hint="0.12 = 12%"
          />
          <TextField
            name="min_amount"
            label="Minimum amount"
            type="number"
            step="0.01"
            inputMode="decimal"
            defaultValue={String(program?.min_amount ?? 0)}
          />
        </div>
        <TextField
          name="sort_order"
          label="Sort order"
          type="number"
          inputMode="numeric"
          defaultValue={String(program?.sort_order ?? 0)}
        />
        <label className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-line px-4">
          <span className="text-[15px] font-semibold text-ink">Offered on quotes</span>
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={program?.is_active ?? true}
            className="h-6 w-6 accent-[var(--brand-primary)]"
          />
        </label>
      </Card>

      <FormMessage error={state.error} />
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="lg" onClick={onDone} className="flex-1">
          Cancel
        </Button>
        <span className="flex-[2]">
          <SubmitButton />
        </span>
      </div>
    </form>
  );
}
