import type { AuditEvent } from '@milvaloop/types';

import { formatAmount, formatPeriodLabel } from '../contributions/format-period';

function actorLabel(event: AuditEvent): string {
  return event.actor?.email ?? 'Someone';
}

function stringField(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === 'string' ? value : undefined;
}

function numberField(metadata: Record<string, unknown>, key: string): number | undefined {
  const value = metadata[key];
  return typeof value === 'number' ? value : undefined;
}

// The subject of a member-scoped event: whichever member the action was
// about, not the actor who did it. Every action that has one embeds an
// `email` directly in its own metadata (see contributions.service.ts and
// members.service.ts) — an audit log should stay legible on its own,
// without depending on a live lookup against current membership state
// that may no longer include the person by the time this is read.
function subjectLabel(event: AuditEvent): string {
  return stringField(event.metadata, 'email') ?? 'a member';
}

type Describer = (event: AuditEvent) => string;

// One line per action this feature actually produces (see the `action`
// values in contributions.service.ts and members.service.ts) — a lookup
// table, not a long if/else chain, so adding a new action later is one
// new entry rather than a growing conditional. `describeAuditEvent`'s
// fallback covers anything not yet listed here.
const DESCRIBERS: Record<string, Describer> = {
  'member.invited': (event) => `${actorLabel(event)} invited ${subjectLabel(event)}`,
  'member.invite_revoked': (event) => `${actorLabel(event)} revoked the invite to ${subjectLabel(event)}`,
  'member.invite_accepted': (event) => `${subjectLabel(event)} joined the cooperative`,
  'member.permissions_updated': (event) => `${actorLabel(event)} updated permissions for ${subjectLabel(event)}`,
  'member.removed': (event) => `${actorLabel(event)} removed ${subjectLabel(event)}`,
  'contribution.share_price_set': (event) => {
    const amount = numberField(event.metadata, 'amount');
    const effectiveFrom = stringField(event.metadata, 'effectiveFrom');
    const amountClause = amount !== undefined ? ` to ${formatAmount(amount)}` : '';
    const effectiveClause = effectiveFrom ? ` effective ${formatPeriodLabel(effectiveFrom)}` : '';
    return `${actorLabel(event)} set the share price${amountClause}${effectiveClause}`;
  },
  'contribution.recorded': (event) => {
    const amount = numberField(event.metadata, 'amount');
    const amountClause = amount !== undefined ? ` of ${formatAmount(amount)}` : '';
    return `${actorLabel(event)} recorded a contribution${amountClause} for ${subjectLabel(event)}`;
  },
  'contribution.approved': (event) => {
    const amount = numberField(event.metadata, 'amount');
    const amountClause = amount !== undefined ? ` of ${formatAmount(amount)}` : '';
    return `${actorLabel(event)} approved ${subjectLabel(event)}'s contribution${amountClause}`;
  },
  'contribution.rejected': (event) => {
    const amount = numberField(event.metadata, 'amount');
    const amountClause = amount !== undefined ? ` of ${formatAmount(amount)}` : '';
    const reason = stringField(event.metadata, 'reason');
    return `${actorLabel(event)} rejected ${subjectLabel(event)}'s contribution${amountClause}${reason ? ` — ${reason}` : ''}`;
  },
};

export function describeAuditEvent(event: AuditEvent): string {
  const describe = DESCRIBERS[event.action];
  return describe ? describe(event) : `${actorLabel(event)} — ${event.action}`;
}
