// Run with: pnpm --filter @milvaloop/main tenant:set-plan <tenantId|slug> <free|premium> [expiresOn]
//
// The one lever an operator has for moving a tenant between plans — there
// is no payment integration (see docs/PLATFORM_BRAINSTORMING.md's pricing
// discussion), so this is called by hand after confirming payment outside
// the app. `expiresOn` (YYYY-MM-DD) is required for 'premium' — it's the
// date getTenantAccessState starts counting down from, same whether this
// is extending an existing Premium tenant after a renewal or moving a Free
// tenant to Premium for the first time.
import { createDb, eq, schema } from '@milvaloop/db';

import { env } from '../src/config/env';

const { tenants } = schema;

async function main() {
  const [tenantRef, plan, expiresOn] = process.argv.slice(2);
  if (!tenantRef || (plan !== 'free' && plan !== 'premium')) {
    console.error(
      'Usage: tenant:set-plan <tenantId|slug> <free|premium> [expiresOn YYYY-MM-DD]',
    );
    process.exitCode = 1;
    return;
  }
  if (plan === 'premium' && !expiresOn) {
    console.error('premium requires an expiresOn date (YYYY-MM-DD)');
    process.exitCode = 1;
    return;
  }

  const db = createDb(env.DATABASE_URL);
  const isUuid = /^[0-9a-f-]{36}$/i.test(tenantRef);
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(isUuid ? eq(tenants.id, tenantRef) : eq(tenants.slug, tenantRef))
    .limit(1);
  if (!tenant) {
    console.error(`No tenant found for "${tenantRef}"`);
    process.exitCode = 1;
    return;
  }

  const premiumExpiresAt =
    plan === 'premium' ? new Date(`${expiresOn}T00:00:00.000Z`) : null;
  await db
    .update(tenants)
    .set({ plan, premiumExpiresAt, updatedAt: new Date() })
    .where(eq(tenants.id, tenant.id));

  console.log(
    `${tenant.name} (${tenant.slug}) is now on ${plan}${
      premiumExpiresAt
        ? `, expiring ${premiumExpiresAt.toISOString().slice(0, 10)}`
        : ''
    }.`,
  );
}

main()
  .then(() => process.exit())
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
