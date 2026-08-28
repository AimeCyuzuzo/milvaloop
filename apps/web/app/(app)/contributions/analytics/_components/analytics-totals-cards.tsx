import type { AnalyticsTotals } from '@milvaloop/types';

import { Card, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';

import { formatAmount } from '@/lib/contributions/format-period';

const CARDS: Array<{
  label: string;
  key: keyof AnalyticsTotals;
  format: (value: number) => string;
}> = [
  { label: 'Active members', key: 'activeMembers', format: (value) => String(value) },
  { label: 'Total shares outstanding', key: 'totalSharesOutstanding', format: (value) => String(value) },
  { label: 'Total contributed (cost basis)', key: 'totalCostBasis', format: formatAmount },
  { label: 'Pending approval', key: 'totalPendingAmount', format: formatAmount },
  { label: 'Rejected, all-time', key: 'totalRejectedAmount', format: formatAmount },
];

// Every cooperative-wide total the ledger can produce, in one row — the
// point of this report is that nothing on it needs adding up by hand.
export function AnalyticsTotalsCards({ totals }: { totals: AnalyticsTotals }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CARDS.map((card) => (
        <Card key={card.key}>
          <CardHeader>
            <CardDescription>{card.label}</CardDescription>
            <CardTitle size="lg">{card.format(totals[card.key])}</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
