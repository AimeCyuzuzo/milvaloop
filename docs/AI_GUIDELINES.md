# AI Development Guidelines

Rules of engagement for an AI assistant/agent working in this codebase.
These are behavioral guardrails, not a restatement of the stack or
architecture — for that, see [`PROJECT_SETUP_GUIDE.md`](./PROJECT_SETUP_GUIDE.md).

If any instruction here conflicts with a direct, explicit request from the
person you're working with in the moment, flag the conflict rather than
silently overriding a standing rule.

---

## 1. Non-negotiables

- **Never commit or push without an explicit go-ahead for that specific
  change.** Being told to proceed on the *work* is not the same as being
  told to commit it — ask (or wait to be told) before `git commit`/`git
  push`, every time, even mid-session, even if earlier work in the same
  session was committed with permission.
- **Never run install, migration, or schema-generation commands** (`install`,
  `db:migrate`, `db:generate`/`db:push`, or equivalents) yourself. These
  touch shared state (lockfiles, a live database) that the person working
  with you owns the timing of — run the code that would need them, then say
  what needs to be run and let them run it.
- **Never run a destructive or hard-to-reverse command** (`git reset --hard`,
  `git push --force`, dropping/truncating data, deleting a branch, rewriting
  history on a shared branch) without explicit confirmation for that exact
  command, even if the general task implies it might be needed.
- **Never commit a secret** — API keys, tokens, passwords, connection
  strings, `.env` itself. Check what a broad `git add` is about to stage
  before staging it, every time, not just when the diff looks sensitive.
- **Never fabricate.** Don't invent an API response, a config value, a test
  result, or a "this works" claim you haven't actually verified. Don't
  assume a library, function, or API exists because it sounds plausible —
  check the actual dependency/docs before calling it.
- **Never overwrite or delete a file you haven't read.** Look at what's
  there first, even when asked to replace it wholesale, even when told
  "it's fine, just overwrite it."

## 2. Ask, don't invent

- When a requirement is ambiguous, contradictory, or missing information
  needed to proceed correctly, **stop and ask** — state the specific fork
  and the options you're weighing, don't silently pick one and continue as
  if it were the obviously correct choice.
- This applies to genuinely unclear product/architecture decisions, not to
  every small implementation detail — use judgment for things a competent
  engineer would just decide (a variable name, which existing utility to
  call), and ask for things that change behavior, data shape, or what the
  feature actually does.
- A wrong guess compounds silently across everything built on top of it; a
  clarifying question costs one exchange. When in doubt, that trade favors
  asking.
- Don't quietly expand scope beyond what was asked ("while I'm in here...")
  without flagging it first — a drive-by refactor bundled into an unrelated
  change makes the diff harder to review and harder to revert cleanly.
- If a genuinely better approach exists than the one requested, say so and
  let the person decide — don't silently substitute your own plan for the
  one you were given.

## 3. Match what's already there

- Before writing new code, read the surrounding file(s) and match their
  naming, comment density, and idiom — a codebase with one dominant style
  reads as if one disciplined author wrote it; a patchwork of "how I'd
  personally write it" per file is a cost every future reader pays.
- Prefer the pattern already established elsewhere in the codebase for the
  same kind of problem over introducing a second, different way to do the
  same thing — even if you'd have designed it differently starting fresh.
  If the existing pattern is actually wrong, say so and propose fixing it
  everywhere, don't quietly add a competing pattern next to it.
- Don't introduce a new folder/file-naming convention, a new state-
  management approach, or a new error-handling style without a concrete
  reason the existing one doesn't fit — and say what that reason is.

## 4. Component & UI reuse discipline

- **Never duplicate a UI block.** If you catch yourself writing the same
  JSX shape more than once with only the text/values changed, stop and
  extract a data array + `.map()` (with a real unique `key`, not the array
  index) instead of hand-copying it a third time.
- **Never pass a custom className, inline style, or one-off Tailwind
  arbitrary value to an imported/shared component** — not even "it's just a
  margin." If a component needs a visual variant, add a real `variant` to
  its own definition (the pattern most component libraries use `cva` or
  equivalent for) — a real, named design state, not a one-off override. If
  you need spacing/positioning around a component, wrap it in a plain HTML
  element and put the className on the wrapper, never on the component
  itself.
- Before building any UI element from scratch, check whether the shared
  component library already has it (or something close enough to extend).
  Don't hand-roll a button/modal/dropdown/table a design system already
  solves.
- Extract a new shared component/hook/utility once it has a **second real
  use site**, not preemptively — one caller isn't a pattern yet. The same
  rule applies on the backend: a repeated query pattern, permission check,
  or response-shaping helper is extracted once two call sites need it, not
  copy-pasted a second time.
- Keep the shared UI package's public exports current — re-export new
  shared primitives from its index/barrel file so nothing shared is only
  reachable by a deep import path.

## 5. Styling: tokens only

- No hardcoded hex values or arbitrary sizing (`text-[#1a1a1a]`, `mt-[13px]`)
  in application code — colors, spacing, and typography come from the
  design system's tokens/theme variables, always.
- Icons come from one shared icon set, consistently — don't mix icon
  libraries or hand-draw an icon that set already has.

## 6. Copy & microcopy

- Use plain, direct, industry-standard labels — "Log in", "Sign up",
  "Settings" — never invented, poetic, or marketing-flavored wording for an
  ordinary action ("Access Dashboard", "Embark On Your Journey").
- No decorative or unnecessary emoji in UI text, commit messages, or
  assistant responses.
- Match terminology the codebase/docs have already established for a
  concept — don't introduce a second word for something that already has a
  name (check existing docs/types before naming something new).

## 7. Framework rendering discipline (React Server/Client components)

- Server Components (or the framework's server-rendered default) are the
  default. Add a client-boundary directive (e.g. `"use client"`) only on
  the specific component that actually needs interactivity — state,
  effects, browser APIs, event handlers — as the very first line of that
  file, and no higher in the tree than necessary.
- Keep layout and page-level containers server-rendered wherever possible;
  push the client boundary down to the smallest interactive leaf, not up to
  the whole page.

## 8. Data & backend discipline

These reinforce [`PROJECT_SETUP_GUIDE.md`](./PROJECT_SETUP_GUIDE.md) — full
detail lives there, not repeated here:

- Validate every input at a trust boundary; don't rely on a compile-time
  type surviving the network.
- Multi-step writes that must succeed or fail together run in one
  transaction; side effects external to the database (email, webhooks, jobs)
  happen after commit, not inside the transaction.
- Anything that can race under concurrent requests needs a real database
  constraint, not a check-then-write gap.
- A permission/ownership check happens on the backend, on every protected
  route — never assume the frontend hiding a control is the actual
  enforcement.

## 9. Dependency discipline

- Don't add a new dependency for something a few lines of code or an
  existing dependency already handles — check `package.json` before
  reaching for a new package.
- When a new dependency is genuinely warranted, say what it's for and why
  the alternative (writing it, or an existing dependency) doesn't fit,
  rather than adding it silently as part of an unrelated change.
- Keep the lockfile committed and consistent with `package.json` — don't
  hand-edit a lockfile.

## 10. Error handling

- Don't swallow an error silently (an empty `catch`, a `.catch(() => {})`
  that discards the failure). Handle it meaningfully, log it with enough
  context to debug later, or let it propagate — pick one on purpose.
- Don't add a broad `try/catch` around a block just to suppress a type or
  runtime error you don't understand yet — understand the failure first.
- Return/throw errors in the shape the rest of the codebase already uses
  (a consistent error type/response shape) rather than inventing a new one
  per endpoint or function.

## 11. Security & secrets hygiene

- Never log, print, or return a secret, password, token, or personal
  identifying data — including in debug output, error messages, or a
  response meant only for the owner of that data.
- Treat all external input (request bodies, query params, third-party API
  responses, file uploads) as untrusted, regardless of who's authenticated
  — authentication proves identity, it doesn't validate the payload.
- Don't weaken an existing security control (a permission check, a rate
  limit, input validation) to make a feature "just work" during
  development — if a control is genuinely getting in the way, say so and
  ask, don't route around it.

## 12. Code hygiene

- Don't leave dead code behind: commented-out old implementations, unused
  imports/variables/exports introduced by your own change, or a debug
  `console.log` left in.
- Comments explain *why the code is the way it is*, never the history of
  how it got there. Don't narrate a diff, a fix, a past mistake, or a
  conversation — no "added this because the user asked for X," no "fixed
  a bug where...," no "this used to be a hardcoded hex, now it's a
  token," no "no longer does Y," no "restored the comment that got
  deleted." A comment should read identically whether the code was
  written five minutes ago or five years ago: state the durable reasoning
  (why this constraint, this shape, this ordering exists) as a fact about
  the current code, not as an edit relative to some prior version a
  future reader never saw and doesn't have this conversation for context
  on. If the only thing worth saying is what changed, that belongs in the
  commit message, not the code.
- Prefer the smallest correct diff. Don't rewrite a whole file when an
  edit to the relevant lines does the job — a large, low-signal diff is
  harder to review and hides the actual change inside noise.
- When you notice an unrelated duplicate, dead code, or a leftover
  stub/`TODO` while working in a file, clean it up in the same change —
  even if it predates your work. Leave the file smaller and cleaner than
  you found it.

## 13. Testing

- Write tests for new logic as part of the change, not as an afterthought —
  a change without a test is a change nobody has actually verified.
- A test must exercise real behavior, not just assert that a mock returns
  what you told it to return — mocking the thing you're supposed to be
  proving works makes the test pass regardless of whether the code is
  correct.
- **Run the full written automated test suite at the end of every sprint/
  iteration of work, not just the tests for the file you touched.** A change
  that passes its own new tests but breaks an existing test elsewhere is not
  done — the whole suite is the actual bar, and it's run before the sprint
  is reported complete, every time, not just when something feels risky.

## 14. Verification before claiming something is done

- Before saying a change is complete: typecheck, lint, and build every
  package/app you touched — for the whole workspace if the change could
  affect a shared package, not just the one file you edited.
- For anything with real interaction (a UI flow, an auth/email flow, a
  file upload), actually exercise it — open the page and click through it
  (mobile width first), send the request and check the real response —
  rather than inferring correctness from reading the code.
- Never leave a stub, a placeholder, a hardcoded demo value, or a
  `TODO`-marked half-feature in something presented as finished — either
  finish it or say plainly that it isn't done yet.

## 15. Documentation stays in sync

- If a change alters setup steps, environment variables, ports, seed data,
  or how a feature is used, update the relevant doc (README, setup guide,
  code comment) in the *same* change — not as a follow-up that may never
  happen.
- If you notice existing documentation is wrong or stale while working
  nearby, fix it or flag it — don't leave a doc you know is incorrect for
  the next person to trip over.

## 16. Reporting honestly

- Report outcomes as they actually are: if a test failed, say so with the
  actual output; if a step was skipped, say which one and why; don't round
  a partial result up to "done."
- Summarize what changed and why in plain language at the end of a task —
  not an exhaustive transcript of every command run, and not silence about
  a compromise or limitation you know about but didn't fix.
- If you made a judgment call instead of asking (per §2, for something
  minor enough not to warrant stopping), say what you decided and why, so
  it can be corrected cheaply if it was the wrong call.

## 17. When you're not sure this file applies

If a rule here doesn't fit something genuinely unusual about the task in
front of you, that's itself worth surfacing rather than silently deciding
the rule doesn't apply — say what seems to conflict and let the person
you're working with make the call.
