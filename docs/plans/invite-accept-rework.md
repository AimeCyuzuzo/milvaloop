# Invite-accept flow rework, and the "already authenticated" redirect gap

## Context

Two real problems surfaced after using the shipped Members Management feature:

1. **`/invite/accept`'s security model is wrong.** Today, `POST /members/invites/accept` treats *possession of the invite link* as proof of identity — if a user already exists for the invited email, the endpoint logs in as that user with no password check at all, regardless of whether the person clicking the link is already authenticated as someone else, or authenticated as nobody. That's the same trust level as a magic link, which is too permissive for "someone else is inviting you into their cooperative." The expected flow is standard: not logged in → log in first; logged in → just accept; no account at all → say so.

   It also has no idempotency handling — the page always calls the mutating accept endpoint on load, so a reload after a successful accept (or on an already-consumed/expired invite) just throws a raw error instead of showing a clean state.

2. **Nothing redirects an already-authenticated visitor away from `/auth/*`.** `(app)/layout.tsx` redirects an unauthenticated visitor out to `/auth/login`; there's no symmetric guard the other way. This is a plain missing check, not an architecture problem — `apiFetch`/TanStack Query/Zustand are fine as they are.

Explicitly deferred (per discussion): surfacing a pending invite on the workspace-selection page or in a notifications area, so someone doesn't need the original email at all. Nothing in this plan blocks that later — the new lookup endpoint below is exactly what such a feature would also read from.

## Decisions made

- **New-user path stays inline on `/invite/accept`**, not a redirect to `/auth/signup` — signup always creates a new cooperative alongside the account, which would leave an unwanted extra cooperative for someone who's only trying to join the one they were invited to. The step is just labeled honestly now ("Create your account to join {cooperative}"), not a bare, unexplained password field.
- **Only `/auth/*` gets the already-authenticated redirect for now**, not the public marketing homepage — a logged-in visitor might genuinely want to view it (share a link, check pricing); auto-bouncing them away from a page they navigated to on purpose is its own UX call, left alone.

## Backend changes (`services/main`, `packages/types`)

### New: invite lookup (read-only, safe to call on every page load/reload)

`GET /members/invites/lookup?token=...` — public, throttled same tier as `magic-link/consume` (10/15min; it takes arbitrary user input same as any public token-consuming route). Returns one of:

```ts
export const inviteLookupResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('pending'), email: z.email(), tenantName: z.string(), hasAccount: z.boolean() }),
  z.object({ status: z.literal('expired') }),
  z.object({ status: z.literal('consumed') }),
  z.object({ status: z.literal('invalid') }),
]);
```

`hasAccount` isn't an enumeration leak here — the caller already needed the high-entropy token (which only ever reached them by email) to ask the question in the first place.

### Split `acceptInvite`

- **`MembersService.joinViaInvite(claims, token)`** (new) — for an already-authenticated caller. Loads the invite, confirms `pending` and not expired, loads the caller's own user row and confirms `user.email` matches `invite.email` (case-insensitive) — mismatch throws `ForbiddenException` with a message the frontend renders directly (no email needs to leak beyond what the caller already knows about themselves). Inserts the membership for `claims.sub`, marks the invite consumed, audit-logs `member.invite_accepted` same as today. Then calls `authService.switchCooperative(claims, { cooperativeId: invite.tenantId }, rawRefreshToken)` — reused as-is, it already does exactly "confirm membership, rotate the refresh session, issue a session for that tenant."
- **`MembersService.acceptInvite`** (existing method, narrowed) — drops the `existingUser` branch entirely. Only ever creates a brand-new user. `password` moves from optional to required in `acceptInviteSchema` (it's now only ever called from the "no account" state). If a user for that email exists by the time this runs (a real but narrow race — someone signed up between the lookup and this submit), throw `ConflictException` ("An account with this email already exists — please log in instead") rather than silently authenticating as it.

### Controller

- `GET /members/invites/lookup` — public, throttled.
- `POST /members/invites/accept` — public, throttled (unchanged route, narrowed behavior, `password` now required).
- `POST /members/invites/:token/join` — `AccessTokenGuard`, no extra throttle (matches `switchCooperative`'s own convention — identity is already proven). Returns `AuthSession`.

### `packages/types`

- `inviteLookupResultSchema` (above) + `InviteLookupResult` type.
- `acceptInviteSchema`: `password: passwordSchema.optional()` → `password: passwordSchema`.
- `inviteTokenParamSchema = z.object({ token: z.string().min(1) })` for the new `:token` route param.

## Frontend changes (`apps/web`)

### Shared redirect-target helper

New `apps/web/lib/navigation/redirect-target.ts`:

```ts
// Only ever a same-origin relative path — never trust a raw `redirect`
// query value into router.push/replace without this, or it's an open
// redirect.
export function getSafeRedirectTarget(raw: string | null, fallback = '/dashboard'): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return fallback;
}
```

Used by:
- `(app)/layout.tsx`'s existing "not authenticated → send to login" redirect: carries the current path forward (`/auth/login?redirect=<current path>`), so logging back in returns you where you were instead of always `/dashboard`.
- `auth/layout.tsx`'s new "already authenticated → send away" redirect (below): reads the same `redirect` param, defaults to `/dashboard`.
- `login/page.tsx` and `magic-link/page.tsx`'s post-success navigation.
- `CooperativeChallengeCard`'s two cards (`SelectCooperativeCard`/`CreateFirstCooperativeCard` in `components/auth/cooperative-challenge.tsx`), which currently hardcode `/dashboard` — takes a `redirectTo` prop instead, threaded from whichever page renders it.

### `auth/layout.tsx` — the actual bug fix

Add the symmetric check: once `useCurrentSessionQuery()` resolves with a session, `router.replace(getSafeRedirectTarget(searchParams.get('redirect')))` instead of rendering the auth page underneath.

### `/invite/accept` — full rewrite

Replaces the current single-form-with-optional-password page. Calls `useInviteLookupQuery(token)` (new, plain `useQuery`, no mutation — safe on every reload) and `useCurrentSessionQuery()`, then renders one of:

- **loading** → skeleton (both queries pending).
- **`status: 'expired'`** → "This invite has expired, ask for a new one."
- **`status: 'consumed'`** → "This invite has already been used," with a link into the app or to login depending on session state.
- **`status: 'invalid'`** → "This invite link is invalid."
- **`status: 'pending'`, no session** → **`hasAccount: true`**: "Log in to accept this invite," linking to `/auth/login?redirect=/invite/accept?token=...`. **`hasAccount: false`**: the inline "Create your account to join {tenantName}" form (email shown read-only from the lookup, password field, calls the narrowed `acceptInvite` endpoint).
- **`status: 'pending'`, session, email matches** (exact match — no email in this codebase is normalized/compared case-insensitively anywhere else, so this doesn't invent a new convention just for itself) → "You've been invited to join {tenantName}" with a single "Accept invite" button, calling the new `useJoinInviteMutation` (authenticated, no form).
- **`status: 'pending'`, session, email doesn't match** → "This invite was sent to {email}, you're logged in as {session.user.email}," with a "Log out" action (`useLogoutMutation`, then to `/auth/login?redirect=...` so they can log back in as the right person).

### `use-members-mutations.ts`

- `useAcceptInviteMutation` — unchanged shape (still `useLoginResultMutation`), just the input's `password` is no longer optional.
- `useJoinInviteMutation` (new) — `POST /members/invites/:token/join`, authenticated, returns `AuthSession` directly (not a `LoginResult` union — an already-authenticated caller joining a specific cooperative has no 0/1/N ambiguity to resolve). Behaves like `useIssueSessionMutation`: stores the token, seeds the session cache via `applyIssuedSession`.

## Testing

- `services/main/test/members.e2e-spec.ts`: replace the existing-user-unauthenticated accept test with the new authenticated `join` endpoint's cases (matches → session for the new tenant; mismatch → 403; not authenticated → 401). New-account `accept` test drops the "no password" case (now a validation error, not optional) and adds the race-condition 409.
- New `packages/types` unit coverage for `inviteLookupResultSchema`'s four branches and the now-required `password` in `acceptInviteSchema`.
- Frontend: no existing test suite covers `apps/web` yet (matches the rest of the app) — verified via typecheck/lint/build plus a real browser walkthrough per the project's verification rule, same as the rest of this feature.

## Build order

1. ✅ Done. `packages/types` — `inviteLookupResultSchema`, narrowed `acceptInviteSchema` (`password` required), `inviteTokenParamSchema`. Unit tests added (`members.spec.ts`).
2. ✅ Done. `services/main` — `MembersService.lookupInvite` + `joinViaInvite` (reuses `AuthService.switchCooperative` once the membership exists) + narrowed `acceptInvite` (drops the existing-user branch, adds a 409 for the account-created-in-the-meantime race), controller routes (`GET /members/invites/lookup`, `POST /members/invites/:token/join`). `members.e2e-spec.ts` updated: the old "existing user gets logged in via the invite link" test is now "rejects when an account already exists" (409), plus new `describe` blocks for lookup (4 cases) and join (4 cases, including single-use). 28/28 passing.
3. ✅ Done. `apps/web/lib/navigation/redirect-target.ts`.
4. ✅ Done. `auth/layout.tsx` fix — split into a server component (keeps its `metadata` export) rendering a new client `AuthGate` that redirects an already-authenticated visitor to `?redirect=` or `/dashboard`. This is the actual bug reported.
5. Partially done, one piece cut: `login`/`magic-link` pages now read `?redirect=` and pass it through `CooperativeChallengeCard`'s new `redirectTo` prop. **Not done**: threading a return-path back through `(app)/layout.tsx`'s existing "not authenticated → send to login" redirect. That would need `useSearchParams()` inside the main app shell, which Next.js wants wrapped in a `Suspense` boundary — doable, but restructuring the app shell for a nice-to-have that wasn't actually requested (the ask was the invite flow and the auth-page redirect) felt like the wrong tradeoff mid-build. `(app)/layout.tsx` still redirects to a plain `/auth/login` with no return path; revisit if losing your place on session expiry turns out to matter in practice.
6. ✅ Done. `use-invite-lookup-query.ts` (new), `use-members-mutations.ts`'s `useJoinInviteMutation` (new — needed `applyIssuedSession` exported from `use-auth-mutations.ts`, since it doesn't fit `useIssueSessionMutation`'s always-`skipAuth: true` shape).
7. ✅ Done. `/invite/accept` fully rewritten — six states (missing token, loading, invalid, expired, consumed, pending — the last split by authentication/email-match/hasAccount into log-in-first, wrong-account, create-account, and accept-as-current-user).
8. ✅ Verification done on my end: typecheck/lint clean across `packages/types`, `services/main`, `apps/web`; `packages/types` unit tests (50/50) and `services/main` unit (38/38) + e2e (76/76) all pass. **The real click-through still needs a human** (I have no browser tool) — see the checklist below.

Nothing here touches the discovery-on-workspace-selection/notifications idea — left for later, and the lookup endpoint is what it would build on.

## Manual verification checklist (not yet done — needs a human)

- Sign up account A (founder of Coop 1). Invite an email that already has an account (account B, founder of Coop 2) — accept while logged in as B (single click, lands in Coop 1), while logged in as some other account (blocked, "wrong account", log-out button works), while logged out (redirected to login, redirected back to the invite after logging in as B).
- Invite a brand-new email — accept via the inline "create your account" step, confirm it lands in the dashboard.
- Reload `/invite/accept?token=...` at every stage above (mid-flow, after accepting, well after expiry if you can force one) and confirm it shows a clean status instead of erroring.
- Visit `/auth/login` (or any `/auth/*` page) while already logged in — confirm it bounces straight to `/dashboard` instead of showing the form.
- Mobile width for all of the above, per `DESIGN.md`.
