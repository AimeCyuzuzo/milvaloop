import type { PeriodStatusValue } from '@milvaloop/types';

export const PERIOD_STATUS_LABEL: Record<PeriodStatusValue, string> = {
  satisfied: 'Satisfied',
  partial: 'Partial',
  due: 'Due',
  overdue: 'Overdue',
  prepaid: 'Prepaid',
  upcoming: 'Upcoming',
};

export const PERIOD_STATUS_BADGE_VARIANT: Record<PeriodStatusValue, 'successSoft' | 'warningSoft' | 'destructiveSoft' | 'secondary'> = {
  satisfied: 'successSoft',
  prepaid: 'successSoft',
  partial: 'warningSoft',
  due: 'warningSoft',
  overdue: 'destructiveSoft',
  // Neither good nor bad — nothing has happened yet and nothing's expected
  // to have, so it gets a plain neutral badge rather than borrowing the
  // same amber "needs attention" treatment 'due' uses.
  upcoming: 'secondary',
};
