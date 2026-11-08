import type { PeriodStatus } from '@milvaloop/types';

import { Badge } from '@milvaloop/ui/badge';
import { Card, CardContent } from '@milvaloop/ui/card';
import { Typography } from '@milvaloop/ui/typography';

import { formatAmount } from '@/lib/contributions/format-period';
import { PERIOD_STATUS_BADGE_VARIANT, PERIOD_STATUS_LABEL } from '@/lib/contributions/period-status-labels';

export interface PeriodStatusRow {
  key: string;
  label: string;
  period: PeriodStatus;
}

// One row per period-status fact — reused for both directions this data
// gets read (see ContributionsService.getAnalytics's `members[].periods`):
// one member's own history across every period (MemberSummaryCard,
// MemberDetailDialog), and one period's breakdown across every member
// (PeriodDetailDialog). `label` is whichever axis isn't the one being
// drilled into. Below md this renders as a stacked card list instead of
// the compact row — a dense text row reads fine at arm's length on a
// desktop monitor, not on a phone.
export function PeriodStatusRows({ rows }: { rows: PeriodStatusRow[] }) {
  if (rows.length === 0) {
    return (
      <Typography variant="small" color="muted">
        Nothing to show yet.
      </Typography>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map(({ key, label, period }) => (
          <Card key={key}>
            <CardContent className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Typography className="truncate">{label}</Typography>
                <Badge variant={PERIOD_STATUS_BADGE_VARIANT[period.status]}>{PERIOD_STATUS_LABEL[period.status]}</Badge>
              </div>
              <Typography variant="small" color="muted">
                {formatAmount(period.paidAmount)} / {formatAmount(period.dueAmount)}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="hidden md:flex md:flex-col md:gap-2">
        {rows.map(({ key, label, period }) => (
          <div key={key} className="flex flex-wrap items-center justify-between gap-2">
            <Typography variant="small">{label}</Typography>
            <div className="flex items-center gap-2">
              <Typography variant="small" color="muted">
                {formatAmount(period.paidAmount)} / {formatAmount(period.dueAmount)}
              </Typography>
              <Badge variant={PERIOD_STATUS_BADGE_VARIANT[period.status]}>{PERIOD_STATUS_LABEL[period.status]}</Badge>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
