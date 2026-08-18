'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AppUser, UserRole } from '@/lib/types/db';
import { inviteUser, updateTeamMember, type AdminState } from '../actions';
import { TextField, SelectField } from '@/components/ui/Field';
import { FormMessage, SubmitButton } from '@/components/ui/SubmitBar';
import { Button } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';

const ROLES: { key: UserRole; label: string; blurb: string }[] = [
  { key: 'admin', label: 'Admin', blurb: 'Manages pricing, catalog and users' },
  { key: 'manager', label: 'Manager', blurb: 'Views every quote in the company' },
  { key: 'sales_rep', label: 'Sales rep', blurb: 'Creates and manages their own quotes' },
];

export function UsersManager({ users, currentUserId }: { users: AppUser[]; currentUserId: string }) {
  const router = useRouter();
  const [inviting, setInviting] = useState(false);
  const [pending, startTransition] = useTransition();
  const [rowError, setRowError] = useState<string | null>(null);

  const [state, action] = useActionState<AdminState, FormData>(async (prev, formData) => {
    const result = await inviteUser(prev, formData);
    if (result.ok) {
      setInviting(false);
      router.refresh();
    }
    return result;
  }, {});

  const change = (userId: string, patch: { role?: UserRole; is_active?: boolean }) => {
    setRowError(null);
    startTransition(async () => {
      const result = await updateTeamMember({ user_id: userId, ...patch });
      if (result.error) setRowError(result.error);
      else router.refresh();
    });
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pt-5 pb-16">
      <h1 className="mb-5 text-[26px] font-semibold tracking-tight text-ink">Users</h1>

      <div className="space-y-2">
        {users.map((user) => {
          const isSelf = user.id === currentUserId;
          return (
            <Card key={user.id} className={user.is_active ? '' : 'opacity-60'}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[16px] font-semibold text-ink">
                    {user.full_name ?? user.email}
                    {isSelf ? <span className="ml-2 text-[12px] font-bold text-muted">YOU</span> : null}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-muted">{user.email}</p>
                </div>
                {!isSelf ? (
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={pending}
                    className={user.is_active ? 'text-danger' : ''}
                    onClick={() => change(user.id, { is_active: !user.is_active })}
                  >
                    {user.is_active ? 'Deactivate' : 'Reactivate'}
                  </Button>
                ) : null}
              </div>

              <div className="mt-3 flex gap-2 border-t border-line pt-3">
                {ROLES.map((role) => (
                  <button
                    key={role.key}
                    type="button"
                    disabled={isSelf || pending}
                    onClick={() => change(user.id, { role: role.key })}
                    title={role.blurb}
                    className={`min-h-11 flex-1 rounded-xl border text-[13px] font-semibold disabled:opacity-50 ${
                      user.role === role.key
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                        : 'border-line bg-card text-muted'
                    }`}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {rowError ? (
        <p role="alert" className="mt-3 rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          {rowError}
        </p>
      ) : null}

      <div className="mt-6">
        {inviting ? (
          <form action={action} className="space-y-4">
            <SectionTitle>Invite a teammate</SectionTitle>
            <Card className="space-y-3">
              <TextField name="full_name" label="Name" autoCapitalize="words" required />
              <TextField
                name="email"
                label="Email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                required
              />
              <SelectField name="role" label="Role" defaultValue="sales_rep">
                {ROLES.map((role) => (
                  <option key={role.key} value={role.key}>
                    {role.label} — {role.blurb}
                  </option>
                ))}
              </SelectField>
            </Card>
            <FormMessage error={state.error} message={state.message} />
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="lg" onClick={() => setInviting(false)} className="flex-1">
                Cancel
              </Button>
              <span className="flex-[2]">
                <SubmitButton label="Send invitation" pendingLabel="Sending…" />
              </span>
            </div>
          </form>
        ) : (
          <>
            <Button variant="primary" size="lg" fullWidth onClick={() => setInviting(true)}>
              Invite a teammate
            </Button>
            <FormMessage message={state.message} />
          </>
        )}
      </div>
    </main>
  );
}
