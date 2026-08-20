'use client';

import Link from 'next/link';
import type { CooperativeSummary } from '@milvaloop/types';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@milvaloop/ui/select';

import { useSwitchCooperativeMutation } from '@/lib/auth/use-auth-mutations';

// Only rendered when the caller belongs to more than one cooperative (see
// AppLayout) — the list rides along on the session payload already loaded
// on every authenticated page, so no extra request is needed to show it.
export function CooperativeSwitcher({
  currentTenantId,
  cooperatives,
}: {
  currentTenantId: string;
  cooperatives: CooperativeSummary[];
}) {
  const switchCooperative = useSwitchCooperativeMutation();

  function handleChange(cooperativeId: string) {
    if (cooperativeId === currentTenantId) {
      return;
    }
    switchCooperative.mutate({ cooperativeId });
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={currentTenantId} onValueChange={handleChange} disabled={switchCooperative.isPending}>
        <SelectTrigger size="sm" aria-label="Switch cooperative">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {cooperatives.map((cooperative) => (
            <SelectItem key={cooperative.id} value={cooperative.id}>
              {cooperative.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Link href="/cooperatives/new" className="text-muted-foreground text-sm underline-offset-4 hover:underline">
        Add cooperative
      </Link>
    </div>
  );
}
