# Architecture and runtime decision

## Record and execution boundaries

A shared Zod schema validates demo data, domain inputs, Convex validators and page specs. The domain engine is a pure transition layer. Convex queries/mutations authenticate organization membership, load a tenant aggregate using workspace indexes, run the transition, and persist deltas. Product events, audit entries, policy versions, artifact revisions, knowledge chunks and outcomes are append-only. Page content is immutable; publication status can change.

The demo repository imports domain code and the fixture only. It has no route to a live provider adapter. The live runtime refuses demo workspace IDs and synthetic `.example` prospects. Provider credentials are isolated in Node actions and encrypted with random data keys wrapped by a deployment-owned AES-256-GCM root. Tenant and provider identifiers form the authenticated context. The database never stores a customer API key in plaintext.

## Runtime decision

The specification makes Vercel eve adoption conditional on an integration spike. That cloud spike has **not been run**: no runtime or customer provider credentials were supplied. This build uses the Convex durable scheduler as a provisional execution adapter, with intended actions, approvals and audit retained in Convex. It is not a claim that Vercel eve failed or passed evaluation.

A minute cron finds due actions. Ingestion and approvals also wake the runtime immediately. A transactional mutation claims each action, enforces current policy and account state, and prevents another simultaneous action on the same account/channel. Execution checks again before external writes. Replies, activation, conversion, suppression and disconnection invalidate stale work. Page publication's final check and status mutation occur atomically.

A future runtime adapter can replace `convex/runtime.ts` without changing business authority or giving the runtime access to arbitrary vendor tools.

## Delivery guarantees

Stable event IDs and webhook receipt IDs deduplicate ingestion. Transactional action claims prevent parallel dispatch of the same intended action. Successful operations record external IDs. Each external request is attempted once; there are no blind retries for sends, calls, creates or partially completed CRM writebacks.

An external system can accept a request and lose the response. Eve then marks the action failed/uncertain and requires provider reconciliation. Interrupted executing actions are marked for reconciliation after ten minutes. This is **not exactly-once delivery across vendors**, and database transactions cannot close the last millisecond between an external preflight read and a provider accepting a request. The UI does not offer a blind retry button.

Quiet hours and rolling daily caps are evaluated in workspace time. Existing work needs renewed approval when the business brief, brand, signals, or authority change. A new page revision gets an independent artifact and approval; publishing it does not mutate its predecessor.

## Content boundaries

The model sees selected account context and short retrieved passages, never credentials. Retrieved sources cannot change authority. Page output must match a closed component/prop catalog, a bounded acyclic graph, approved CTA destinations, available sources and exact evidence for numeric/proof/offer claims. React escapes text; arbitrary HTML, JavaScript, styles and component names are not accepted.

The writing gate catches prohibited phrases, missing sources, placeholders, excessive links and excessive length. It is a deterministic gate, not a semantic truth oracle. Operators remain responsible for reviewing free-form prose. Keyword-ranked chunks are used for retrieval in V1; no embeddings service is required.

## Current scale boundary

V1 deliberately loads each workspace aggregate for a transition. This makes shared validation and tenant tests straightforward, but is appropriate for a limited pilot, not an unbounded event warehouse. Before high-volume deployment, replace aggregate reads with bounded indexed queries, add event retention/export, paginate account history and scheduler scans, and migrate without changing the domain invariants.
