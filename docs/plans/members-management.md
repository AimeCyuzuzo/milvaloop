# Members Management — end-to-end implementation plan

A point-in-time working plan, not a standing reference doc (see `docs/README.md`
for those) — delete or archive this file once the feature ships and fold
anything durably useful into the standing docs.

## Why this feature, first

Everything else on the roadmap — contributions, later loans and governance —
hangs off "a member of a cooperative." Right now a tenant can only ever have
one person in it: whoever signed up and created it. No second person can join.
That's the actual bottleneck to unblock next, not a preference.

It's also already scoped: `docs/BACKLOG.md`'s "Invites" section pre-specs
the core mechanism (a `membership_invites` table mirroring the existing
magic-link/password-reset token pattern). This plan fills that out into a full
vertical slice — schema, permissions, backend, email, frontend, tests — and
**this document supersedes that backlog entry**; delete the backlog section
once this ships.

It also happens to exercise every layer this codebase has conventions for
(a transactional multi-table write, a hashed single-use token, a tenant-scoped
email, a permission-gated route, an audit trail, a data table with row
actions), which makes it a good feature to nail the *patterns* on before
Contributions reuses all of them.

## Scope for this iteration

**In scope:**
- Inviting someone to a cooperative by email, with the specific permissions
  they'll hold once they accept.
- Accepting an invite — both for someone who already has a MilvaLoop account
  (in this cooperative's context, always a new one — see below) and someone
  who doesn't yet.
- Listing all members of the active cooperative (active and pending-invite,
  in one view) with their permissions.
- Editing a member's permissions.
- Removing a member (soft — see **Removal is soft, not a hard delete** below).
- Revoking a pending invite before it's accepted.
- A minimal audit-event log, introduced now because these are exactly the
  tenant-scoped mutations `CODE_QUALITY.md`'s Observability section requires
  logging, and because this is genuinely the first real infrastructure for
  the product's explainability differentiator (`MAIN.md`) — worth building
  once, correctly, rather than retrofitting after three more features also
  need it.
- A real email templating system in `packages/email`, with one shared
  layout every email renders inside. This is broader than the invite email
  alone — see **Email**, below — it also migrates the three emails
  `AuthService` already sends (magic-link, password reset, email
  verification), which today are inline HTML string literals with no shared
  look between them. Worth flagging clearly: this touches already-shipped
  auth code, not just new code.

**Explicitly out of scope, deferred:**
- A persisted, in-app notification inbox (the bell icon in the sample
  mockup) — the invite **email** is the notification for someone not yet in
  the app; toasts (existing `Sonner` setup, zero new work) cover in-session
  feedback. A real notification table/inbox is its own feature.
- Named roles ("Treasurer," "Secretary") as a first-class concept. The
  permissions array already lets an inviter pick exactly which permissions
  to grant; a role is just a saved permission preset, and isn't worth
  building until real usage shows people re-picking the same combination
  repeatedly.
- Avatar images, a member search/combobox picker, tabs to separate
  active/pending members — none of these have a second real need yet (see
  **Components to add**, below, for what that trims).

## Data model

Two new tables in `packages/db/src/schema/`.

### `membership_invites`

Mirrors `magic_link_tokens`/`password_reset_tokens`'s shape exactly (see
`services/main/src/auth/tokens.ts`'s `generateOpaqueToken`/`hashToken`), with
the tenant-scoping `email_verification_tokens` already needs for the same
reason (an invite is inherently tied to one tenant, not global to a user).

| column            | type                          | notes                                                   |
|-------------------|-------------------------------|----------------------------------------------------------|
| `id`              | `uuid` pk, default random     |                                                          |
| `tenantId`        | `uuid` fk → `tenants.id`, cascade | the cooperative being invited into                  |
| `email`           | `varchar(255)`                | not a `userId` fk — the invitee may not have an account |
| `permissions`     | `text[]`, default `[]`        | granted on acceptance, same shape as `memberships.permissions` |
| `invitedByUserId` | `uuid` fk → `users.id`        | for the audit trail and "invited by" display            |
| `tokenHash`       | `varchar(255)`, unique        | SHA-256 of the opaque token, same as the other token tables |
| `expiresAt`       | `timestamptz`                 | suggest `7d` TTL — long enough for someone to see an email over a weekend, unlike the 15m/1h TTLs on login-adjacent tokens |
| `consumedAt`      | `timestamptz`, nullable       | single-use marker, identical pattern to the other token tables |
| `createdAt`       | `timestamptz`, default now    |                                                          |

Add a unique index on `(tenantId, email)` **where `consumedAt` is null** (a
partial unique index) — prevents two simultaneous pending invites to the same
email for the same cooperative without blocking re-inviting after the first
one is consumed or revoked. This is a real constraint, not a check-then-write
gap (`CODE_QUALITY.md`'s concurrency rule) — handle the conflict on insert,
don't query-then-insert.

Revoking an invite: delete the row (or set `consumedAt` to mark it dead —
lean toward `consumedAt` since it keeps a record of "this invite existed and
was revoked," feeding the audit log's entity reference, rather than a hard
delete that would orphan an audit event's `entityId`).

### `audit_events`

Not specific to this feature — this is the seed of the product's audit log.

| column       | type                       | notes                                                          |
|--------------|----------------------------|------------------------------------------------------------------|
| `id`         | `uuid` pk, default random  |                                                                  |
| `tenantId`   | `uuid` fk → `tenants.id`   | every event is tenant-scoped; no cross-tenant queries by design |
| `actorUserId`| `uuid` fk → `users.id`, nullable | null for system-initiated events (invite auto-expiry, etc.) |
| `action`     | `varchar(100)`             | dot-namespaced, e.g. `member.invited`, `member.invite_accepted`, `member.permissions_updated`, `member.removed`, `member.invite_revoked` |
| `entityType` | `varchar(50)`              | `membership` / `membership_invite`                              |
| `entityId`   | `uuid`, nullable           |                                                                  |
| `metadata`   | `jsonb`                    | action-specific detail — e.g. `{ email, permissions }` on invite, `{ before, after }` on a permissions edit |
| `createdAt`  | `timestamptz`, default now |                                                                  |

A small `AuditLogService` (`services/main/src/audit/audit-log.service.ts`)
exposes one method, `record(tx, event)`, called **inside the same
transaction** as the mutation it's logging — an audit entry that exists
without the mutation it describes (or vice versa) defeats the point.

## Permissions

Confirmed direction: `tenant:admin` is a blanket override, not one flag among
equals — both `PermissionsGuard` (backend) and the new frontend hook check
"has `tenant:admin` OR has the specific permission," so an admin's membership
row only ever needs the one flag.

New values, added to `packages/types/src/permissions.ts`'s existing
`PERMISSIONS` object (same `"<namespace>:<action>"` shape as `tenant:admin`):

```ts
export const PERMISSIONS = {
  TENANT_ADMIN: 'tenant:admin', // existing — overrides every check below
  MEMBERS_INVITE: 'members:invite',
  MEMBERS_EDIT: 'members:edit',
  MEMBERS_REMOVE: 'members:remove',
} as const;
```

- Viewing the members list is **not** permission-gated — every member of a
  cooperative can see who else is in it. Only the write actions are gated.
- The person who creates a cooperative (`AuthService.insertTenantAndMembership`)
  must be granted `tenant:admin` on that membership at creation — confirm
  this is already true; if the founder's membership currently gets an empty
  `permissions` array, that's a real bug to fix as part of this work (a
  cooperative with no one able to invite a second member is a dead end).

## Backend

New `MembersModule` (`services/main/src/members/`) — a new bounded context
alongside `AuthModule` (identity/session) and `CooperativesModule`
(tenant/org entity), not folded into either. `MembersController`,
`MembersService`, reusing `PermissionsGuard`/`@RequirePermissions` (currently
defined but unused anywhere in the codebase — this is its first real
consumer) and the existing `AccessTokenGuard`.

Reuse from `services/main/src/auth/tokens.ts` directly: `generateOpaqueToken`,
`hashToken`, `parseTtlMs`. Add an `INVITE_TTL = '7d'` constant alongside the
existing `MAGIC_LINK_TTL`/`EMAIL_VERIFICATION_TTL`/`PASSWORD_RESET_TTL` group
in `auth.service.ts`, or colocate it in the new module if that reads cleaner
— minor call, decide when writing the code.

| Method | Path | Guard | Notes |
|---|---|---|---|
| `GET` | `/members` | `AccessTokenGuard` only | Lists active memberships + pending invites for the caller's active tenant, unified (see **Frontend pages**). |
| `POST` | `/members/invite` | `AccessTokenGuard` + `@RequirePermissions(MEMBERS_INVITE)` | Body: `{ email, permissions }`. Transaction: insert the invite row, commit, *then* send the email (side effects after commit, per `CODE_QUALITY.md`) — send failure is logged, not thrown, same as the existing magic-link pattern, but unlike login-adjacent emails this one probably *should* surface a toast-visible warning to the inviter ("invite created, but the email failed to send") since there's no enumeration-protection reason to hide it here. |
| `POST` | `/members/invites/:id/revoke` | `AccessTokenGuard` + `@RequirePermissions(MEMBERS_INVITE)` | Sets `consumedAt`, writes `member.invite_revoked`. |
| `PATCH` | `/members/:membershipId/permissions` | `AccessTokenGuard` + `@RequirePermissions(MEMBERS_EDIT)` | Body: `{ permissions }`. Guard against a member removing their own `tenant:admin` if they're the *only* admin left on the tenant — a cooperative permanently locked out of its own admin actions is a real failure mode worth a real check, not just "technically possible." |
| `DELETE` | `/members/:membershipId` | `AccessTokenGuard` + `@RequirePermissions(MEMBERS_REMOVE)` | Soft — see below. Same last-admin guard applies. |
| `POST` | `/members/invites/accept` | Public (no `AccessTokenGuard` — the invitee may not have a session yet) | Body: `{ token, password? }`. Branches on whether `email` already has a `users` row: existing user → create the membership, then reuse `AuthService.finishLogin`'s branching exactly as `docs/BACKLOG.md` specifies; no existing user → also requires `password` in the body, creates the user + membership in one transaction. Rate-limit this route the same way `AuthController`'s other unauthenticated routes are (`CODE_QUALITY.md`'s throttling rule explicitly calls for this on every auth-adjacent endpoint, and this is one). |

**Removal is soft, not a hard delete.** Add `removedAt: timestamptz, nullable`
to `memberships` rather than deleting the row on `DELETE /members/:id`. Two
real reasons, not caution for its own sake: contributions (the next feature)
will very likely reference a membership by id, and a hard-deleted membership
either orphans that reference or forces a cascade that erases someone's
contribution history right when explainability matters most; and the audit
event for the removal itself needs something to point `entityId` at. Every
membership query elsewhere (`getCurrentSession`, the switcher, permission
checks) filters `removedAt IS NULL`.

## Email

Revised from the original plan: a real templating system, not one more
inline HTML string literal. Four emails needing a consistent, branded look
(the three `AuthService` already sends, plus this feature's invite email) is
past the point where hand-writing HTML per call site holds up — this is a
genuine second-and-third-and-fourth consumer, not premature abstraction.

**Library: `react-email`** (`@react-email/components` + `@react-email/render`).
Renders React components to HTML + plaintext server-side — fits this stack
(TypeScript, React everywhere else) better than a string-templating engine
(Handlebars/EJS) would, and slots in without touching `Mailer` at all:
`Mailer.send()` already takes a plain `{ to, subject, html, text }`
(`packages/email/src/mailer.ts:9-14`), so a render step just produces the
`html`/`text` before the existing `this.mailer.send({...})` call sites —
`AuthService`'s control flow barely changes. (Also fittingly the same
library Resend — the reference this whole design direction started from —
publishes and uses itself.)

**New structure in `packages/email/src/`:**

```
templates/
  brand.ts                      — literal hex brand constants (see below)
  layout.tsx                    — <EmailLayout>, wraps every email
  magic-link-email.tsx          — migrated from auth.service.ts's inline HTML
  password-reset-email.tsx      — migrated
  email-verification-email.tsx  — migrated
  invite-email.tsx              — new, for this feature
render.ts                       — renderEmail(element) => { html, text }
```

**`brand.ts` is a deliberate, scoped exception to "tokens only."** Email
HTML can't consume CSS custom properties or Tailwind's oklch output — most
mail clients strip `<style>` blocks or simply don't support modern CSS color
functions. `brand.ts` hand-converts the same "Ledger" values already in
`packages/ui/src/styles/globals.css` (Navy `#2E3251`, Sky `#7AB6F9`, Teal
`#31C195`, Amber `#D98E3F`, Coral `#D6483F`) to literal hex, once, in this
one file — commented as to why, so it doesn't read as a rule violation to
the next person who greps for a hex value. **Real, known cost**: if the
brand palette changes, both files need updating by hand; not worth
`drizzle-zod`-style automated sync machinery for five color values.

**`EmailLayout`** — logo mark (the same small rounded badge + "MilvaLoop"
wordmark used in the app itself, as literal styled text — no image asset or
image hosting exists yet, and none is worth standing up for this), the
email's content, then a footer line ("MilvaLoop is a product of MilvaLabs").
Every template (`MagicLinkEmail`, `PasswordResetEmail`,
`EmailVerificationEmail`, `InviteEmail`) wraps its content in this layout
and gets nothing else to worry about.

**Deliberately out of scope**: email dark-mode. Mail-client support for
`prefers-color-scheme` in HTML email is inconsistent enough (Apple/iOS Mail
yes, Gmail partial, Outlook no) that replicating the web app's light/dark
token system here isn't worth it for what's mostly a read-once transactional
email — one light, brand-consistent design covers this well.

**Call-site change**, e.g. the magic-link email (`auth.service.ts` around
line 300):

```ts
const { html, text } = await renderEmail(MagicLinkEmail({ loginUrl }));
await this.mailer
  .send({ to: user.email, subject: 'Sign in to MilvaLoop', html, text })
  .catch((error: unknown) => { this.logger.error(...); });
```

The invite email follows the identical shape: subject `You've been invited
to join {tenant.name} on MilvaLoop`, links to
`${env.WEB_ORIGIN}/invite/accept?token=${rawToken}`. Reuse `WEB_ORIGIN` — no
new env var; `packages/config`'s existing convention only adds one when a
link genuinely needs a different origin, which this doesn't.

**New dependencies** (`packages/email`): `@react-email/components`,
`@react-email/render` (runtime); `react`, `react-dom` (peer, needed to
render — pin to the same versions `packages/ui` already uses); `react-email`
itself as a dev dependency purely for its local preview server (`email dev`)
— lets templates be iterated on visually in a browser without sending real
mail through Mailpit for every tweak.

## Frontend routes & pages

- **`/(app)/members`** — the members list. One `DataTable` (existing shared
  component), one row per membership *or* pending invite, unified — a
  "Status" column (`Active` / `Invited` / `Expired`, using the `successSoft`/
  `warningSoft`/`mutedSoft`-style `Badge` variants already added for the
  Contributions mockup) distinguishes them rather than splitting into tabs.
  Primary action "Invite member" top-right, one tap away per `DESIGN.md`'s
  UX principle. Row actions (the same hover-revealed `⋯` pattern built for
  the sample): "Edit permissions" (opens the Sheet), "Resend invite"/"Revoke
  invite" for pending rows, "Remove" for active rows (opens the confirm
  dialog). All three write actions are hidden entirely (not just disabled)
  for a viewer without the matching permission — never rely on a disabled
  button as the actual control.
- **`/invite/accept`** — public page (outside the `(app)` route group,
  alongside `/auth/*`), reached from the emailed link. Branches the same way
  the backend does: existing-user invitee sees a lightweight "Accept and
  continue" (they're logged in already, or get a login prompt first — mirror
  whatever `magic-link/consume` does for an already-authenticated visitor);
  new-user invitee sees essentially the signup form (`apps/web/app/auth/
  signup/page.tsx`) minus the cooperative-name field, since they're joining
  an existing one, not creating one — the tenant name comes from the invite
  and is shown read-only, not editable.

## Components to add

Only two new shared components are actually needed — resist adding more than
the feature requires:

- **Dialog** (`packages/ui/src/components/ui/dialog.tsx`) — the "Invite
  member" form and the "Remove member" confirmation. Add via the shadcn CLI
  convention (`components.json`'s `new-york` style) the same way
  `dropdown-menu.tsx` was hand-authored to match shadcn's real output when
  the CLI wasn't run directly.
- **Sheet** (`packages/ui/src/components/ui/sheet.tsx`) — the "Edit
  permissions" drawer. A side drawer suits a permissions checklist better
  than a centered dialog (more vertical room, doesn't feel like a
  destructive/blocking action the way a centered modal does).

Not needed for this scope, confirmed absent and deliberately not adding them
now: **Avatar** (the existing hand-rolled initials-circle, already used
consistently in the sample mockup and the app header, covers this — a real
`Avatar` component is worth adding once uploaded profile photos exist, via
`packages/storage`, not before), **Command/combobox** (invites are by typed
email, not picked from a list), **Tabs** (the unified table replaces the
need for one).

## Reusable modals / drawers

- **`InviteMemberDialog`** — email input + a checkbox per `PERMISSIONS`
  value (skip `TENANT_ADMIN` here; granting full admin access should be a
  deliberate, separate, probably confirmation-gated action, not one checkbox
  among others in the default invite flow). On submit: `POST /members/invite`,
  toast confirmation, close, refetch the list (TanStack Query invalidation,
  not a manual refetch call).
- **`RemoveMemberDialog`** (built on the new `AlertDialog`-style confirm
  pattern, or a plain `Dialog` with a destructive `Button` — decide when
  Dialog is in hand) — names who's being removed, explains it's reversible
  only by re-inviting them, since a soft-removed membership doesn't
  automatically un-remove.
- **`EditPermissionsSheet`** — same checkbox list as the invite dialog,
  pre-checked to the member's current permissions, plus the last-admin guard
  surfaced as a disabled checkbox + explanatory text rather than a silent
  no-op if this member is the only remaining admin.

All three are genuinely reused (list row actions call them, and the invite
dialog's trigger appears twice — the page header button and, once
Contributions exists, likely an empty-state "invite your first member" CTA)
— comfortably past the "second real consumer" bar for extracting them as
named components rather than inlining JSX per call site.

## Frontend permissions plumbing

- `apps/web/lib/auth/use-permissions.ts` — `useHasPermission(permission)` and
  `usePermissions()`, both derived from `useCurrentSessionQuery()`'s existing
  `session.permissions`, both short-circuiting true on `TENANT_ADMIN`. Import
  the `Permission` type from `@milvaloop/types` — do not redeclare it on the
  frontend.
- Nav items (wherever the sidebar's `NAV_ITEMS`-equivalent lands in the real
  app, following the sample's shape) each carry an optional
  `requiredPermission?: Permission`; the sidebar filters through
  `useHasPermission`. Members itself needs no `requiredPermission` to
  *appear* — everyone can view it — only its internal actions gate.
- Restated because it matters: none of this is the actual security boundary.
  Every one of the backend routes above is guarded independently; the
  frontend hiding a button is UX, not enforcement.

## Notifications

In scope: toast confirmations via the existing `Sonner`/`Toaster` setup for
every write action above (invite sent, invite revoked, permissions updated,
member removed) — zero new infrastructure, just call sites.

Out of scope, deferred: a persisted in-app notification inbox. Track it in
`docs/BACKLOG.md` once this feature ships, if it doesn't already come up
naturally when Contributions needs a similar "someone should know this
happened" moment.

## Testing

- Unit (`*.spec.ts`, colocated): the permissions-check logic itself
  (`hasPermission`'s admin-override branching) both backend and frontend;
  the invite-token TTL constant parsing if any new logic beyond
  `parseTtlMs` is added; the partial-unique-index conflict mapping (a
  `db-errors.spec.ts`-style test, matching the existing `services/main/src/
  common/db-errors.spec.ts` pattern for `users_email_unique` etc.); a
  render test per email template (`invite-email.spec.tsx` etc., Vitest —
  `packages/email` is a plain TS package) asserting the rendered HTML/text
  actually contains the accept URL, the tenant name, and doesn't throw on
  render — not a pixel-perfect snapshot, just "the template renders and
  says the right thing."
- **Check the existing auth e2e/unit tests before migrating the three
  existing emails.** If anything in `auth.e2e-spec.ts` or the
  `fake-mailer` test double asserts on the *exact* previous inline-HTML
  string rather than checking the link/URL is present in `html`/`text`,
  that assertion breaks and needs updating to match — expected, not a sign
  something's wrong, but worth calling out so it isn't a surprise mid-change.
- Integration (`services/main/test/members.e2e-spec.ts`, matching the
  existing `cooperatives.e2e-spec.ts` naming/setup): invite → accept
  (both branches: existing user, new user) → appears in `GET /members`;
  permission enforcement (403 for a caller without `members:invite` etc.);
  the partial unique index actually rejects a second simultaneous invite to
  the same email; the last-admin guard actually blocks removing/demoting
  the sole admin; soft-removal excludes the member from `GET /members` and
  from permission checks without deleting the row.
- A separate `members-rate-limit.e2e-spec.ts` if `/members/invites/accept`
  needs its own file to avoid the same `ThrottlerModule` interference
  `auth-rate-limit.e2e-spec.ts` was split out to avoid — likely yes, same
  reasoning applies.

## Docs to update in the same change

- Delete `docs/BACKLOG.md`'s "Invites" section once this ships (per that
  file's own rule: remove an item once it's done).
- Delete or archive this file.
- If the founder's-membership-permissions bug (see **Permissions**, above)
  turns out to be real, note the fix in the PR description — it's a
  pre-existing bug this feature surfaces, not something this feature
  introduces.

## Suggested build order

1. `packages/db`: `membership_invites` + `audit_events` schema, the
   `removedAt` column on `memberships`, the partial unique index, a
   migration (`pnpm db:generate` — you run this, not me).
2. `packages/types`: new `PERMISSIONS` values, request/response Zod schemas
   for the new endpoints.
3. ✅ Done. `packages/email`: the templating system — `brand.ts`,
   `EmailLayout`, `renderEmail`, the three existing emails migrated onto
   it. Verified for real through Mailpit (desktop and mobile). Two things
   from this step still need doing when the rest of this feature is built:
   the `InviteEmail` template itself (needs the invite token/URL shape from
   step 4), and a font/typeface pass to match the sans-only, no-monospace
   decision made afterward (packages/ui's tokens changed since this
   shipped; the email templates predate that call and weren't revisited).
4. ✅ Done. `AuditLogService`, `MembersModule` (service + controller + all
   six endpoints + rate limiting), `InviteEmail`. The founder's membership
   does get `TENANT_ADMIN` on signup — confirmed via a real signup, so
   that open question is resolved, no fix needed. Also found and fixed a
   real gap while wiring the guard in: `PermissionsGuard` never actually
   implemented the "admin gets everything" override this plan assumed —
   it still required every specific permission listed individually.

   Two refinements to what this plan originally sketched, both safety
   improvements: `grantablePermissionSchema` excludes `TENANT_ADMIN`
   entirely (can't be granted *or* revoked through the edit-permissions
   endpoint — enforced at the schema layer, not just the UI), so editing
   someone's non-admin permissions can never silently de-admin them as a
   side effect of the request body structurally not being able to include
   it. The last-admin guard this plan described therefore only applies to
   `DELETE /members/:id` (a removal genuinely drops every permission the
   membership held, admin included) — not to the permissions-edit
   endpoint, which can't touch admin status at all.
5. ✅ Done. `members.e2e-spec.ts` — 15 cases covering invite, both accept
   branches (new/existing user), revoke, permission edit (including the
   admin-preservation guarantee above), remove, and the last-admin guard.
   No rate-limit split needed — none of the new tests hit the throttled
   routes enough to trip `ThrottlerModule`. The auth test fix (token
   extraction reading the HTML href, not the plain-text body) shipped with
   the email work in step 3, not held for this step.
6. `packages/ui`: `dialog.tsx`, `sheet.tsx`.
7. Frontend: `useHasPermission`/`usePermissions`, `InviteMemberDialog`,
   `RemoveMemberDialog`, `EditPermissionsSheet`, the `/members` page, the
   `/invite/accept` page.
8. Wire permission-driven nav filtering using the real sidebar (once it
   exists as a real component, not just the sample mockup).
9. ✅ Backend half done: a real signup → invite → real Mailpit delivery →
   real accept (new-user branch) → `GET /members` showing both, all
   exercised live against the running server, not just the automated
   suite. The "at mobile width" half waits on step 7 — there's no page to
   open yet.
10. Docs cleanup (above) — not done yet, still mid-build.

## Open decisions to confirm before/while building

- `MembersModule` as its own bounded context — done; built as a separate
  module per this plan's recommendation, not folded into Cooperatives.
- `7d` invite TTL — arbitrary but reasonable; change if you want something
  else.
- `/members/invite`'s email-send failure is logged only, **not** surfaced
  to the inviter as a visible warning — this plan originally said it
  should be, but that needs a response-shape change (an `emailSent` flag)
  that felt like scope creep mid-implementation. Flagging the deviation
  rather than quietly matching what the plan said; revisit if you want it.
  holds.
- `audit_events` schema above is deliberately minimal (one flat table, no
  per-domain sub-tables) — fine to start, but worth knowing this is the
  shape every future feature's audit trail will follow unless revisited.
- Logo-as-styled-text in emails vs. a real logo image — this plan defaults
  to text (no image asset/hosting exists yet); swap in an image later
  without touching the rest of the layout once brand assets exist.
- Email dark-mode — this plan skips it (see **Email**); say so if you'd
  rather attempt it despite inconsistent mail-client support.
