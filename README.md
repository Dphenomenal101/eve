# Eve

[Public repository](https://github.com/Dphenomenal101/eve)

A revenue teammate for developer-first products. Eve turns confirmed product signals into useful, reviewable actions: an implementation page, a helpful email, an opted-in call, or a CRM update. When a prospect replies or activates, obsolete follow-ups stop.

Built with Next.js, React, TypeScript, Convex, Better Auth, Base UI, JSON Render, and the AI SDK. MIT licensed; self-hostable with your own accounts.

## Try the complete demo

Requires Node.js 22+ and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open [localhost:3000/overview?demo=1](http://localhost:3000/overview?demo=1), then **Rehearsal**. Approve the page and email, simulate the first successful request, and approve the CRM update. Reset demo restores the original fixture.

No credentials are needed. The demo uses one schema-validated fixture in `src/demo/demo-data.ts`, a separate repository, a deterministic clock, and simulated providers. Changes remain in browser session storage. Demo pages use `/preview/`; live publication uses `/p/`. Demo mode is available only with `EVE_ENABLE_DEMO_MODE=true`.

## What is implemented

- Overview, searchable and filterable accounts, account timelines, artifacts, memory, audit history, playbook, connections, onboarding, and guided rehearsal.
- Better Auth Google/magic-link sign-in, organizations, invitations, and owner/admin/operator/viewer authorization.
- Authenticated direct/PostHog ingestion, tenant-scoped identity resolution, replay protection, confirmed signal interpretation, and Context.dev company enrichment.
- Observe, Copilot, and Autopilot policies; global/account/channel pause; quiet hours; frequency limits; suppression; expiring approvals; immutable artifact revisions.
- Constrained JSON Render pages, generation through AI Gateway, preview, publication, revision, and unpublication. Emails wait until their linked page is published.
- AgentMail inbox verification, send, direct inbound-state checks, signed reply/bounce/complaint webhooks, and follow-up cancellation.
- HubSpot through Composio: company/contact resolution, lifecycle updates, activity notes with page links, and qualified-opportunity creation/update. Pipeline mapping is read from the connected account.
- Retell credential/resource verification, consent-recorded call preparation, approval and dispatch, and signed call outcomes.
- Encrypted workspace-owned credentials and a durable Convex execution queue with transactional action claims.

**Validation status:** the local demo's six-step browser rehearsal, TypeScript check, production build, and automated domain/database tests have been exercised. Live OAuth, provider delivery, and deployment verification require your accounts and have not been run. The browser regression suite is included for local/CI runs. See [implementation status](docs/STATUS.md) for limits and [self-hosting](docs/SELF_HOSTING.md) for setup.

## Development

```sh
npm run dev           # Next.js
npm run convex:dev    # configure/synchronize your Convex development deployment
npm run typecheck
npm test              # domain, security, adapter and Convex integration tests
npm run build
npm run check         # typecheck + tests + production build
npx playwright install chromium
npm run test:e2e      # desktop and mobile browser regressions
npm run format
```

There are no Eve-owned secrets or hosted services required by a fork. Customer AgentMail, Retell, and Context.dev credentials are entered in Connections. Auth email, Composio infrastructure, encryption, and AI Gateway credentials are set on your Convex deployment.

## Architecture

`src/domain` owns validated records, policy checks, identity resolution, and action transitions. `src/demo` runs the same domain code without a provider path. `convex` owns authenticated storage, ingestion, durable scheduling, and internal execution. `src/server` isolates encryption and vendor adapters. UI components consume the repository boundary.

[Architecture and runtime decision](docs/ARCHITECTURE.md) · [Self-hosting](docs/SELF_HOSTING.md) · [Implementation status](docs/STATUS.md) · [Contributing](CONTRIBUTING.md) · [Third-party notices](THIRD_PARTY_NOTICES.md)
