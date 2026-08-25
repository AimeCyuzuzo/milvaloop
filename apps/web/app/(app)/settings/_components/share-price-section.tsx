'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Skeleton } from '@milvaloop/ui/skeleton';
import { Typography } from '@milvaloop/ui/typography';

import { formatAmount, formatPeriodLabel } from '@/lib/contributions/format-period';
import { useShareSettingsQuery } from '@/lib/contributions/use-share-settings-query';

import { SetSharePriceDialog } from './set-share-price-dialog';

// The one place the share price is set or changed — Contributions itself
// only ever displays it, and links here when nothing's set up yet, so
// there's a single home for this rather than the same action reachable
// two different ways.
export function SharePriceSection() {
  const { data: settings, isPending } = useShareSettingsQuery();
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
                    <Typography variant="small">{formatAmount(price.amount)}</Typography>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
