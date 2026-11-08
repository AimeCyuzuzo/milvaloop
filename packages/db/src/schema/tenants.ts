import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  // Null until the founder finishes (or explicitly skips) the guided setup
  // — share price, members, historical contributions — that a newly
  // created tenant is walked through before reaching the normal
  // dashboard. Checked on every request as the gate into that flow, not
  // just at signup, so a second cooperative created later goes through it
  // too.
  onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
  // 'free' | 'premium' (see @milvaloop/types' getTenantAccessState, the one
  // place that turns this plus premiumExpiresAt into an actual access
  // decision). Every tenant starts 'free'; moving to 'premium' and keeping
  // it there both happen the same way — an operator extends
  // premiumExpiresAt after confirming payment outside the app (see
  // services/main/scripts/set-tenant-plan.ts), since there is no payment
  // integration.
  plan: text('plan').notNull().default('free').$type<'free' | 'premium'>(),
  // Null on the Free plan, which never expires. On Premium, the date
  // access (not just billing) stops working without a further extension —
  // set once at signup for the initial trial, then moved forward each time
  // payment is confirmed. A date in the past is what makes a tenant
  // locked; nothing else about "locked" is stored, it's derived from this.
  premiumExpiresAt: timestamp('premium_expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
