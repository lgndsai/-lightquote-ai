'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CatalogItem, CatalogKind, PriceUnit } from '@/lib/types/db';
import { deleteCatalogItem, saveCatalogItem, type AdminState } from '../actions';
import { TextField, SelectField } from '@/components/ui/Field';
import { FormMessage, SubmitButton } from '@/components/ui/SubmitBar';
import { Button } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/pricing/engine';

const KINDS: { key: CatalogKind; label: string; units: PriceUnit[] }[] = [
  { key: 'adder', label: 'Adders', units: ['per_foot', 'each', 'flat', 'percent'] },
  { key: 'controller', label: 'Controllers', units: ['flat'] },
  { key: 'track_color', label: 'Track colors', units: ['flat'] },
  { key: 'discount', label: 'Discounts', units: ['flat', 'percent'] },
];

const UNIT_LABEL: Record<PriceUnit, string> = {
  flat: 'Flat',
  per_foot: 'Per foot',
  each: 'Each',
  percent: 'Percent',
};

export function CatalogManager({ items }: { items: CatalogItem[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<CatalogKind>('adder');
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  const active = KINDS.find((k) => k.key === kind)!;
  const visible = items.filter((item) => item.kind === kind);

  const remove = (id: string) => {
    startTransition(async () => {
      await deleteCatalogItem(id);
      router.refresh();
    });
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pt-5 pb-16">
      <h1 className="mb-1 text-[26px] font-semibold tracking-tight text-ink">Catalog</h1>
      <p className="mb-4 text-[15px] text-muted">
        What every rep can add to a quote. Removing an item hides it from new quotes and leaves
        existing ones untouched.
      </p>

      <div className="-mx-4 mb-5 px-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {KINDS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                setKind(option.key);
                setEditing(null);
                setCreating(false);
              }}
              className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold ${
                kind === option.key ? 'bg-ink text-white' : 'border border-line bg-card text-muted'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {editing || creating ? (
        <ItemForm
          key={editing?.id ?? 'new'}
          item={editing}
          kind={kind}
          units={active.units}
          onDone={() => {
            setEditing(null);
            setCreating(false);
            router.refresh();
          }}
        />
      ) : (
        <>
          <div className="space-y-2">
            {visible.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
                Nothing here yet.
              </p>
            ) : (
              visible.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-2xl border p-4 ${
                    item.is_active ? 'border-line bg-card' : 'border-line/60 bg-card/60 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[16px] font-semibold text-ink">{item.name}</p>
                      {item.description ? (
                        <p className="mt-0.5 text-[13px] text-muted">{item.description}</p>
                      ) : null}
                      <p className="mt-1 text-[13px] font-semibold text-muted">
                        {item.unit === 'percent'
                          ? `${Number(item.price)}%`
                          : formatCurrency(Number(item.price), { maximumFractionDigits: 2 })}{' '}
                        · {UNIT_LABEL[item.unit]}
                        {item.is_active ? '' : ' · hidden'}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="secondary" size="md" onClick={() => setEditing(item)}>
                        Edit
                      </Button>
                      {item.is_active ? (
                        <Button
                          variant="secondary"
                          size="md"
                          className="text-danger"
                          disabled={pending}
                          onClick={() => remove(item.id)}
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
              Add {active.label.replace(/s$/, '').toLowerCase()}
            </Button>
          </div>
        </>
      )}
    </main>
  );
}

function ItemForm({
  item,
  kind,
  units,
  onDone,
}: {
  item: CatalogItem | null;
  kind: CatalogKind;
  units: PriceUnit[];
  onDone: () => void;
}) {
  const [state, action] = useActionState<AdminState, FormData>(async (prev, formData) => {
    const result = await saveCatalogItem(prev, formData);
    if (result.ok) onDone();
    return result;
  }, {});

  return (
    <form action={action} className="space-y-4">
      <SectionTitle>{item ? 'Edit item' : 'New item'}</SectionTitle>
      <Card className="space-y-3">
        <input type="hidden" name="id" value={item?.id ?? ''} />
        <input type="hidden" name="kind" value={kind} />
        <TextField name="name" label="Name" defaultValue={item?.name ?? ''} required />
        <TextField name="description" label="Description" defaultValue={item?.description ?? ''} />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            name="price"
            label="Price"
            type="number"
            step="0.01"
            inputMode="decimal"
            defaultValue={String(item?.price ?? 0)}
            required
          />
          <SelectField name="unit" label="Unit" defaultValue={item?.unit ?? units[0]}>
            {units.map((unit) => (
              <option key={unit} value={unit}>
                {UNIT_LABEL[unit]}
              </option>
            ))}
          </SelectField>
        </div>
        <TextField
          name="sort_order"
          label="Sort order"
          type="number"
          inputMode="numeric"
          defaultValue={String(item?.sort_order ?? 0)}
        />
        <label className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-line px-4">
          <span className="text-[15px] font-semibold text-ink">Available on quotes</span>
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={item?.is_active ?? true}
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
