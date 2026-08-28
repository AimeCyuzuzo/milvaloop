import type { ColumnDef } from '@tanstack/react-table';
import type { AuditEvent } from '@milvaloop/types';

import { describeAuditEvent } from '@/lib/audit/describe-audit-event';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const activityColumns: ColumnDef<AuditEvent>[] = [
  {
    id: 'event',
    accessorFn: (row) => describeAuditEvent(row),
    header: 'Event',
  },
  {
    id: 'createdAt',
    accessorFn: (row) => row.createdAt,
    header: 'When',
    cell: ({ getValue }) => formatDateTime(getValue<string>()),
  },
];
