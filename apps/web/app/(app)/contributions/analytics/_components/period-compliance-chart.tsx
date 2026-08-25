import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import type { AnalyticsPeriodRow } from '@milvaloop/types';

import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@milvaloop/ui/chart';

import { formatPeriodLabel } from '@/lib/contributions/format-period';

// Same status → color mapping as the badges elsewhere in this feature
// (satisfied=success, overdue=destructive), split one step further than
// a badge can afford room for: partial (paid something) and due (paid
// nothing yet) share a badge color but get distinct bars here, since a
// chart showing where a month's compliance actually sits is the reason
// this view exists.
const CHART_CONFIG: ChartConfig = {
  satisfied: { label: 'Satisfied', color: 'var(--success)' },
  partial: { label: 'Partial', color: 'var(--warning)' },
  due: { label: 'Due', color: 'var(--muted-foreground)' },
  overdue: { label: 'Overdue', color: 'var(--destructive)' },
};

export function PeriodComplianceChart({ periods }: { periods: AnalyticsPeriodRow[] }) {
  const data = periods.map((period) => ({
    period: formatPeriodLabel(period.period),
    satisfied: period.satisfied,
    partial: period.partial,
    due: period.due,
    overdue: period.overdue,
  }));

  return (
    <ChartContainer config={CHART_CONFIG} className="h-64 w-full">
      <BarChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="period" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="satisfied" stackId="status" fill="var(--color-satisfied)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="partial" stackId="status" fill="var(--color-partial)" />
        <Bar dataKey="due" stackId="status" fill="var(--color-due)" />
        <Bar dataKey="overdue" stackId="status" fill="var(--color-overdue)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
