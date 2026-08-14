# Design & UI/UX Standards

Rules for `apps/web` and `packages/ui`. See [`MAIN.md`](./MAIN.md) for product
overview and layout; see [`CODE_QUALITY.md`](./CODE_QUALITY.md) for
architecture and TypeScript standards. These rules exist to keep a small
codebase looking and feeling like it was built by one disciplined team, not
patched together page by page.

## Components

- **shadcn/ui components only.** Before writing any UI element — a button, a
  form field, a modal, a dropdown, a table, a toast — check
  `packages/ui/src/components/ui/` first. If shadcn has it and it isn't in the
  package yet, add it via the shadcn CLI following the existing
  `packages/ui/components.json` convention (`new-york` style, `neutral` base
  color, CSS variables on, no class prefix) — don't hand-roll a component
  shadcn already solves.
- **Never pass `className` to an imported component — from `packages/ui` or
  any third-party UI library — anywhere, for any reason, including layout and
  spacing.** No exceptions for "it's just a margin." If a component needs a
  visual variant, add or extend a proper `variant` in its own `cva`
  definition (see `packages/ui/src/components/ui/card.tsx`'s `highlighted`
  variant for the pattern: a real design state, not a one-off override). If
  positioning/spacing is needed around a component, **wrap it in a plain
  HTML element** (`div`, `section`) and put the className there — the plain
  wrapper carries layout, the component itself never does. This keeps every
  instance of a component visually identical everywhere it's used, which is
  the entire point of having a design system.
- Icons: `lucide-react` only.
- Colors, spacing, and typography come from the design system's tokens
  (Tailwind theme variables already wired through `packages/ui`) — never a
  hardcoded hex value or an arbitrary Tailwind value (`text-[#1a1a1a]`,
  `mt-[13px]`) in application code.

## Lists and repeated content

Any set of items that share the same visual design is rendered with
`.map()` over a data array — **never** hand-written as N copies of the same
JSX block with different literals inside. If you catch yourself
copy-pasting a card/row/item three times with only the text changed, stop and
extract the shared shape into an array (see `apps/web/app/(public)/pricing/page.tsx`'s
`PLANS.map(...)` or the home page's `FEATURES.map(...)` for the existing
pattern) and map over it. This isn't just style — it's what makes a design
change (or a bug fix) apply everywhere at once instead of needing to be
repeated by hand and inevitably drifting.

## Code arrangement

- Import order: external packages, then workspace packages (`@milvaloop/*`),
  then local relative imports — matches the existing files throughout the
  repo; keep it consistent.
- Extract a component when a shape is reused **twice or more**, or when a
  single file's JSX becomes hard to scan at a glance — not preemptively for a
  single use site (mirrors `CODE_QUALITY.md`'s "second real consumer" rule
  for abstractions generally).
- Co-locate small, page-specific pieces (a form used only on one page) near
  that page; promote something to `packages/ui` or a shared `components/`
  directory only once it's actually shared.
- One component, one responsibility. A component that both fetches data and
  renders a complex layout is a sign it should split into a data-fetching
  parent and a presentational child.

## UX principles

- **Mobile-first.** Most real usage of this product is on a phone (see
  `docs/PLATFORM_BRAINSTORMING.md`'s adoption-constraints findings — smartphone
  ownership and data affordability are real limits in the target market).
  Design and test every screen at mobile width before desktop.
- **The primary action on any screen is one tap away.** If recording a
  contribution takes more than a couple of taps from the dashboard, that's a
  usability bug, not a nice-to-have fix.
- **Progressive disclosure.** Advanced or infrequently-needed options (lump-sum
  allocation, manual corrections, permission editing) live behind an explicit
  "Advanced" toggle or a separate screen — the default flow for the common
  case stays short and obvious.
- **Every derived number should be explainable.** Anywhere the product shows
  a total, a status, or a balance, there should be a way to see why — the
  events that produced it. This is the product's core differentiator (see
  `MAIN.md`), not a reporting afterthought; don't design a number-only screen
  without at least a path to its history.
- **No dead ends.** Empty states explain what to do next (e.g. "No
  contributions yet — record the first one" with the action right there), not
  a bare "No data." Loading states use `Skeleton`, not a blank flash. Actions
  give feedback (a toast confirmation, an optimistic update) — never a click
  that silently does something with no acknowledgment.
- Forms use the shadcn `Form` pattern (react-hook-form + Zod resolver) with
  inline, field-level error messages — never a browser `alert()` or a
  generic top-of-page error banner for a validation problem tied to a
  specific field.

## Accessibility

- Use semantic HTML — but this is never an excuse to hand-write the element
  yourself. "A real `button`, not a `div` with an `onClick`" still means
  reaching for the shadcn `Button` component (which renders a real
  `<button>`), never a custom-built button or a raw `<button>` with ad-hoc
  classes — the "never a custom className on an imported component" rule
  above applies here too, it doesn't get suspended for accessibility
  concerns. Same idea for landmarks (`nav`/`main`/`header`) and heading
  levels: use `Typography`'s `as` prop to get a real `<h2>` etc. rather than
  styling a `div` to look like one — the semantic requirement and the
  component-only requirement are satisfied by the same component, not in
  tension.
- Every form input has a real `Label` associated via `htmlFor` — not
  placeholder text standing in for a label.
- Don't fight the keyboard navigation Radix primitives already give you for
  free (focus trapping in dialogs, roving focus in menus) by adding custom
  focus-management code on top.
