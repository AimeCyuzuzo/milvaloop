'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@milvaloop/ui/chart';
import { Skeleton } from '@milvaloop/ui/skeleton';
import { Typography } from '@milvaloop/ui/typography';

import { formatAmount, formatPeriodLabel } from '@/lib/contributions/format-period';
import { useAnalyticsQuery } from '@/lib/contributions/use-analytics-query';
import { useShareSettingsQuery } from '@/lib/contributions/use-share-settings-query';

// A single series (magnitude over time — see the dataviz skill's
// "sequential" job), so one hue and no legend box; the same `success`
// this chart's own "Total contributed" stat card already uses, since this
// is that number's history, not a separate idea.
const CHART_CONFIG: ChartConfig = {
  total: { label: 'Total contributed', color: 'var(--success)' },
};

// Running total, not a per-month amount — the point is the growth curve
// ("is this cooperative growing"), not how volatile any single month was.
// `analytics.members[].periods[].paidAmount` is already fetched for the
// Analytics page's own drill-down (see ContributionsService.getAnalytics),
// so this needs no new endpoint — just a different way of reading data
// already on the wire.
export function MoneyOverTimeChart() {
  const { data: settings } = useShareSettingsQuery();
  const { data: analytics, isPending } = useAnalyticsQuery(Boolean(settings?.current));

  if (!settings?.current || isPending || !analytics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Total contributed over time</CardTitle>
          <CardDescription>Every approved contribution, running total by month.</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const paidByPeriod = new Map<string, number>();
  for (const member of analytics.members) {
    for (const period of member.periods) {
      paidByPeriod.set(period.period, (paidByPeriod.get(period.period) ?? 0) + period.paidAmount);
    }
  }

  let runningTotal = 0;
  const data = analytics.periods.map((period) => {
    runningTotal += paidByPeriod.get(period.period) ?? 0;
    return { period: formatPeriodLabel(period.period), total: runningTotal };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Total contributed over time</CardTitle>
        <CardDescription>Every approved contribution, running total by month.</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <Typography variant="muted">No periods yet.</Typography>
        ) : (
          <ChartContainer config={CHART_CONFIG} className="h-64 w-full">
            <AreaChart data={data}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="period" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={64} tickFormatter={(value: number) => formatAmount(value)} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatAmount(Number(value))} />} />
              <Area
                type="monotone"
                dataKey="total"
                stroke="var(--color-total)"
                fill="var(--color-total)"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
