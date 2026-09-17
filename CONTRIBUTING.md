# Contributing

Use Node.js 22+ and the committed npm lockfile. Run `npm ci`, copy `.env.example` to `.env.local`, and use the isolated demo for UI work.

Keep business decisions in `src/domain`, vendor APIs in `src/server`, and authenticated persistence in `convex`. Do not import live adapters into `src/demo`, expose credentials through query results, or add example data outside the canonical fixture. Preserve immutable events, audit and artifact revisions.

Before proposing a change, run `npm run check`. For UI or workflow changes, install Chromium with `npx playwright install chromium` and run `npm run test:e2e`. Format with `npm run format`. Explain the user-visible change, test evidence and any live-provider verification still needed.

Never commit `.env.local`, provider tokens, authentication sessions, real customer records, or output from a credential helper. Use reserved `.example` domains in fixtures. Report security issues privately to the repository owner instead of posting secrets in an issue.
