# MilvaLoop Docs

Plain-markdown documentation for the MilvaLoop platform.

## Product

- [Platform brainstorming](./PLATFORM_BRAINSTORMING.md) — exploration of the product
  idea: market landscape, the Rwandan legal frame, evaluation of the concept, gaps,
  and how to validate it cheaply. Not architecture.

## Development

- [Deployment](./DEPLOYMENT.md) — current and target deployment setup, environments,
  and the pre-launch checklist.
- [Project setup guide](./PROJECT_SETUP_GUIDE.md) — the default reference for
  how this project is set up: stack, repo layout, config, Docker, state
  management, caching, ORM, auth/authz, rate limiting, testing, and more.
- [AI development guidelines](./AI_GUIDELINES.md) — behavioral rules for an
  AI assistant working in this codebase: never committing/pushing or running
  sensitive commands without an explicit go-ahead, asking instead of
  inventing when something's ambiguous, component/UI reuse discipline, and
  verifying before claiming a change is done.
- [Backlog](./BACKLOG.md) — work deliberately deferred during a change
  rather than skipped without a record (invites, Redis-backed rate
  limiting, and other items pushed to later).
- [`plans/`](./plans/) — point-in-time end-to-end implementation plans for a
  specific feature (schema, permissions, backend, frontend, tests, build
  order). Not standing reference docs — delete or archive a plan once its
  feature ships.

Repository-wide development rules live under [`.agents/rules/`](../.agents/rules/):
[`MAIN.md`](../.agents/rules/MAIN.md) (overview, layout, workflow),
[`CODE_QUALITY.md`](../.agents/rules/CODE_QUALITY.md) (engineering standards),
[`DESIGN.md`](../.agents/rules/DESIGN.md) (UI/UX and component standards).
