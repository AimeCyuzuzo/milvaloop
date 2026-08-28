'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { SharePrice } from '@milvaloop/types';

import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { ConfirmDialog } from '@milvaloop/ui/confirm-dialog';
import { Skeleton } from '@milvaloop/ui/skeleton';
import { Typography } from '@milvaloop/ui/typography';

import { getErrorMessage } from '@/lib/api/api-fetch';
import { formatAmount, formatPeriodLabel } from '@/lib/contributions/format-period';
import { useDeleteSharePriceMutation } from '@/lib/contributions/use-contribution-mutations';
import { useShareSettingsQuery } from '@/lib/contributions/use-share-settings-query';

import { EditSharePriceDialog } from './edit-share-price-dialog';
import { SetSharePriceDialog } from './set-share-price-dialog';

// The one place the share price is set, changed, or removed — Contributions
// itself only ever displays it, and links here when nothing's set up yet,
// so there's a single home for this rather than the same action reachable
// two different ways. Removing an entry here is the general, later-session
// path for undoing a mistake — the historical-import grid also offers an
// immediate "Undo" right after adding one, but doesn't duplicate a full
// management list of its own.
export function SharePriceSection() {
  const { data: settings, isPending } = useShareSettingsQuery();
  const deleteSharePrice = useDeleteSharePriceMutation();
  const [removing, setRemoving] = useState<SharePrice | null>(null);
  const [editing, setEditing] = useState<SharePrice | null>(null);
  const history = settings?.history.slice().reverse() ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Share price</CardTitle>
        <CardDescription>What one share currently costs, and every price it&rsquo;s had before.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Typography variant="large">
                {settings?.current ? formatAmount(settings.current.amount) : 'Not set up yet'}
              </Typography>
              <SetSharePriceDialog triggerLabel={settings?.current ? 'Change share price' : 'Set up contributions'} />
            </div>
            {history.length > 0 ? (
              <div className="flex flex-col gap-1">
                <Typography variant="muted">History</Typography>
                {history.map((price) => (
                  <div key={price.id} className="flex items-center justify-between gap-4">
                    <Typography variant="small" color="muted">
                      Effective {formatPeriodLabel(price.effectiveFrom)}
                    </Typography>
                    <div className="flex items-center gap-2">
                      <Typography variant="small">{formatAmount(price.amount)}</Typography>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(price)}>
                        Edit
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setRemoving(price)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
      {editing ? (
        <EditSharePriceDialog
          price={editing}
          open
          onOpenChange={(next) => {
            if (!next) {
              setEditing(null);
            }
          }}
        />
      ) : null}
      {removing ? (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) {
              setRemoving(null);
            }
          }}
          title={`Remove the ${formatAmount(removing.amount)} price effective ${formatPeriodLabel(removing.effectiveFrom)}?`}
          description="This can't be undone if a contribution has already used this price to calculate a period."
          confirmLabel="Remove price"
          pendingLabel="Removing…"
          variant="destructive"
          onConfirm={async () => {
            // ConfirmDialog surfaces whatever this throws verbatim as its
            // own message — an ApiError's own .message is just "METHOD
            // /path failed with 4xx", so the server's actual reason (e.g.
            // "already used by a recorded contribution") has to be pulled
            // out here before it reaches the dialog.
            try {
              await deleteSharePrice.mutateAsync(removing.id);
            } catch (error) {
              throw new Error(getErrorMessage(error));
            }
            toast.success('Share price removed.');
          }}
        />
      ) : null}
    </Card>
  );
}
