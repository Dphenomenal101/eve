# Implementation and verification status

The credential-free application and local Git repository are available. GitHub publication is intentionally deferred by the owner. No customer provider credentials, cloud project, or production deployment were configured during this build.

## Verified locally

- Canonical demo fixture conforms to the same validators used by Convex.
- Six-step browser rehearsal reaches completion: separate page/email approval, simulated dispatch, prepared follow-up, activation, obsolete-action cancellation and approved CRM writeback.
- Unit/integration coverage for tenancy, identity conflict, replay, authority, eligibility, pause, suppression, expiry, immutable revisions, ambiguous provider results, encryption context, ingestion limits and independent simulated execution.
- TypeScript and production Next.js builds.

## Implemented; requires account-based acceptance testing

- Convex cloud provisioning/code generation and production deployment.
- Better Auth Google/magic-link delivery and invitation acceptance on a real origin.
- AgentMail send, recent-thread polling and signed reply/bounce/complaint delivery.
- Composio/HubSpot OAuth return, scope availability, pipeline/property mapping and real CRM writes.
- Context.dev coverage and quota behavior for the intended customers.
- Gateway structured page generation for the selected model and material.
- Retell agent/number ownership, consent workflow, actual calls and webhook delivery.
- Vercel eve runtime spike. Convex scheduling is the current provisional runtime.

## Deliberate V1 limits

- HubSpot is the implemented CRM adapter. No Salesforce, Attio, Close or Pipedrive connectors are implied.
- Knowledge uploads support UTF-8 text and Markdown up to 200 KB. PDF/DOCX extraction is not implemented.
- Contextual chat supports bounded evidence explanations, notes, customer/pause commands and explicit policy proposals. It is not an unrestricted model assistant.
- Initial activation drafts use a grounded starter composition; operators can generate model-composed page revisions through AI Gateway. Website research supplies an editable description, not a fully inferred brand or ICP.
- CRM opportunity mapping uses the first configured pipeline/open stage returned by HubSpot. The mapping is displayed; an in-app field-mapping editor is not implemented.
- Account-size/intent policy is enforced. Free-form ICP and writing guidance inform reviewed content; they are not a general-purpose executable rules language.
- The auth component supports organizations and invitations; the current UI opens the first accessible Eve workspace. A multi-workspace switcher is not implemented.
- Bootstrap Convex API references permit offline builds; regenerate and validate them when connecting a real deployment.
- High-volume pagination/retention and fully semantic claim verification need further work before broad production use.

These limits and pending checks are visible so a working demo is not confused with a production-certified provider integration.
