import type { PeriodStatusValue } from '@milvaloop/types';

export const PERIOD_STATUS_LABEL: Record<PeriodStatusValue, string> = {
  satisfied: 'Satisfied',
  partial: 'Partial',
  due: 'Due',
  overdue: 'Overdue',
  prepaid: 'Prepaid',
};

export const PERIOD_STATUS_BADGE_VARIANT: Record<PeriodStatusValue, 'successSoft' | 'warningSoft' | 'destructiveSoft'> = {
  satisfied: 'successSoft',
  prepaid: 'successSoft',
  partial: 'warningSoft',
  due: 'warningSoft',
  overdue: 'destructiveSoft',
};
