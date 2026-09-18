# Self-hosting Eve

## 1. Local app and Convex deployment

Install Node.js 22+, run `npm ci`, copy `.env.example` to `.env.local`, and run `npx convex dev`. Create or select your own Convex project. The CLI generates deployment-specific API types and synchronizes the schema, local Better Auth component, HTTP routes, cron, and functions. Keep this process running alongside `npm run dev`.

Set these Next.js environment variables to the deployment URLs shown by Convex:

| Variable                      | Example / purpose                                                 |
| ----------------------------- | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`      | `https://your-deployment.convex.cloud`                            |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | `https://your-deployment.convex.site` — HTTP/auth/webhooks        |
| `NEXT_PUBLIC_SITE_URL`        | Your Next.js app origin, locally `http://localhost:3000`          |
| `EVE_ENABLE_DEMO_MODE`        | `true` to enable the isolated demo; otherwise omit or set `false` |

Public environment values are embedded at build time. Restart/rebuild Next.js after changing them. Convex's `CONVEX_SITE_URL` is provided by the deployment itself.

The committed `_generated` files are emitted by the Convex CLI. Allow `convex dev` to regenerate them when connecting your project or changing the backend schema; commit the resulting generated types. The local auth schema adds organization, member, invitation, and active-organization fields to the upstream base schema.

## 2. Deployment-owned secrets

Set the following in the **Convex dashboard → Settings → Environment Variables**, not in browser-visible variables. Adding them to Next.js `.env.local` does not synchronize them to Convex. Do not commit keys. You can also use `npx convex env set` from your local terminal.

| Variable                                   | Purpose                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `SITE_URL`                                 | Exact origin of your Next.js app; used by auth, invitations, public page links and CRM callbacks |
| `BETTER_AUTH_SECRET`                       | At least 32 random bytes; for example generate with `openssl rand -base64 32`                    |
| `EVE_ENCRYPTION_KEY`                       | Exactly 32 random bytes encoded as base64; generate independently                                |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth application you own (optional if using magic links)                                 |
| `AUTH_EMAIL_API_KEY`                       | Your Resend key for authentication/invitation email                                              |
| `AUTH_EMAIL_FROM`                          | A sender on your verified Resend domain                                                          |
| `COMPOSIO_API_KEY`                         | Your deployment's Composio infrastructure account                                                |
| `COMPOSIO_HUBSPOT_AUTH_CONFIG_ID`          | Your HubSpot auth configuration in Composio                                                      |
| `CONTEXT_DEV_API_KEY`                      | Deployment-owned Context.dev key for website research and company enrichment                     |
| `AI_GATEWAY_API_KEY`                       | Your Vercel AI Gateway credential                                                                |
| `EVE_MODEL`                                | A structured-output-capable model identifier available to that Gateway account                   |

Keep an encrypted backup of `EVE_ENCRYPTION_KEY`. Losing it makes saved customer credentials unreadable. Changing it alone does not rotate existing envelopes: pause work and reconnect each provider under the new root, or implement a controlled rewrapping migration before replacing it.

For Google, configure the callback `https://YOUR_APP/api/auth/callback/google` (local development may use localhost). Configure Resend and verify a sender before trying magic links. Authentication and invitation emails are separate from prospect outreach.

Open `/login`, sign in, and create a workspace. Invitations are accepted through `/invite/[id]`. Membership is enforced against the Better Auth organization on every live operation. Use the invited email address. Owners/admins configure the workspace; operators review actions and add account context; viewers have read-only access.

## 3. Brief Eve

Enter your website and business description in **Playbook**. Save the website before connecting Context.dev, because the connection verifier researches that domain. Connect Context.dev, then run website research from **Workspace setup** if desired. Confirm the resulting brief yourself.

Upload Markdown/plain-text knowledge (200 KB maximum per file). Add approved claims as exact passages from ready knowledge sources. Confirm an HTTPS or mailto CTA, exclusions, your brand, and at least one signal definition. In particular, map `first_api_request_succeeded` to activation. An `activation_stalled` event must represent an explicit server-side check; absence of telemetry does not trigger outreach.

Company-size eligibility defaults to at least 25 verified employees. Unknown size waits for enrichment. Change the threshold through a reviewed authority-policy proposal if your product serves smaller teams.

## 4. Customer-owned connections

### Product events

In **Connections → Product events**, generate an ingestion key and save it immediately in your application's server environment. Only its hash is stored. Rotation invalidates the old key.

Send server-side requests to `https://YOUR_DEPLOYMENT.convex.site/events` with `Authorization: Bearer YOUR_INGEST_KEY`:

```json
{
  "workspaceId": "YOUR_EVE_WORKSPACE_ID",
  "eventId": "stable-event-uuid",
  "eventName": "user_signed_up",
  "occurredAt": 1789552800000,
  "userId": "user-123",
  "userEmail": "person@customer-domain.com",
  "productWorkspaceId": "customer-workspace-456",
  "companyDomain": "customer-domain.com",
  "properties": { "name": "Product User" }
}
```

Use a **current** Unix millisecond timestamp, not the fixed example. Copy your actual workspace ID and instructions from **Get instrumentation prompt**. Stable event IDs prevent duplicate processing. Events must be no more than 90 days old or five minutes in the future; size is capped at 64 KB and ingestion at 120 requests per workspace per minute. Rejected requests return a safe validation error.

PostHog webhooks go to `/webhooks/posthog` with the same bearer credential. Include a stable UUID or `$insert_id`, email, distinct ID, and workspace/domain properties. PostHog data is normalized and sensitive/non-allowlisted properties are removed.

### AgentMail

Create/select an inbox in your own AgentMail account. Create a signed webhook for `message.received`, `message.bounced`, and `message.complained` at:

`https://YOUR_DEPLOYMENT.convex.site/webhooks/agentmail/YOUR_EVE_WORKSPACE_ID`

In Connections, enter the API key, existing inbox ID, and webhook signing secret (`whsec_…`). Eve verifies inbox access before envelope-encrypting the key and signing secret. Raw secrets are cleared from the form and excluded from audit records and model prompts.

Replies cancel pending outreach. Unsubscribe requests, complaints and bounces suppress the account/contact. Eve also checks recent inbox threads directly before sending, so delayed webhooks are not the only protection. Provider errors or timeouts never trigger an automatic resend.

### HubSpot through Composio

Configure a HubSpot OAuth auth configuration in your Composio account with scopes for company, contact, note/activity, deal, properties and pipeline reads/writes required by your chosen HubSpot account. Follow Composio's current scope names and consent screen.

Click **Authorize with Composio**, authorize the customer-owned HubSpot account, return to Connections, and click **Verify CRM connection**. Eve verifies the connected account's toolkit, status, workspace/user owner, lifecycle property, and deal pipeline. If your Composio flow uses deferred verification, the `session_uri` callback parameter is consumed once during verification and removed from the browser URL.

V1 matches companies by domain and contacts by email. The first pipeline and its first open stage (by display order) are selected from your account and displayed as the opportunity mapping. Adjust pipeline ordering in HubSpot before verification if necessary. Always inspect the CRM artifact and perform your first approved write against a test company you control. Duplicate matches stop the operation. Existing opportunities keep their sales stage; Eve updates qualification context rather than moving the deal backwards.

### Context.dev

Set `CONTEXT_DEV_API_KEY` in the Convex deployment's environment variables. A value in Next.js `.env.local` alone is not available to the Convex backend. In **Connections → Context.dev**, choose **Deployment account** and verify it after saving your business website in Playbook. The key stays in server environment settings; only connection metadata is stored for the workspace. Usage is billed to the deployer's Context.dev account.

Optionally choose **My workspace account** to verify and save an encrypted workspace-owned key instead. That key overrides the deployment account only for this workspace. Switching back to the deployment account removes the saved override. Disconnecting stops research for the workspace; missing or invalid workspace keys never silently fall back to deployment billing. This self-hosted setup does not implement a capped hosted allowance.

Eve verifies the business website, researches descriptions, and enriches prospect company name, industry, and available employee count. Research is cached per account for 24 hours and retains provenance. Failure preserves prior evidence and surfaces a connection warning.

### Retell (optional)

Use an existing Retell agent and phone number you own. Configure the agent with your approved script and AI disclosure. Enter the API key and `agent_id|+E164_CALLING_NUMBER` in Connections. Set the webhook to:

`https://YOUR_DEPLOYMENT.convex.site/webhooks/retell/YOUR_EVE_WORKSPACE_ID`

On an account, choose **Prepare call**, enter the contact's number, and record how they agreed to the call. Review the resulting call plan before dispatch under Copilot. Retell signatures and Eve action metadata are verified before an analyzed call is recorded. Calling remains optional and disconnected by default.

### AI Gateway

Set the model variables on Convex, then click **Verify deployment model**. **Generate page revision** uses structured output, approved claims, targeted retrieval, and the constrained component catalog. Review the generated revision before publication. Structural validation cannot prove every free-form sentence is factually correct; keep generated pages in Copilot until you have evaluated them with your material.

## 5. Rehearse, activate, and deploy

Run **Rehearsal** in your live workspace. The synthetic prospect is permanently blocked from live dispatch by its `.example` domain, even if it is accidentally unpaused. Inspect its drafts, then use a real test address/domain you own for a provider rehearsal. Approving a live action permits a real provider operation.

Start in **Copilot**. Confirm the brief and signals, connect providers, then activate Eve. Inspect the first signup, enrichment, confirmed friction event, page, email, reply/activation, and CRM update. Use global pause while diagnosing any mismatch. Observe creates drafts; Autopilot still enforces all eligibility, suppression, timing, and content gates.

For production, deploy the Convex backend with `npm run convex:deploy`, configure the production environment variables, then build and host Next.js on a Node-capable host with `npm run build` and `npm start`. Set `SITE_URL` to the final HTTPS origin **before creating production workspaces**, because their public page base is stored at creation. Reconfigure callbacks and signed webhook URLs for production. No automatic cloud deployment occurs in this repository.

In a restricted environment where Turbopack cannot bind its local worker port, use the supported alternative `npm run build -- --webpack`.

Official references: [Convex + Better Auth](https://labs.convex.dev/better-auth/framework-guides/next), [local auth schema](https://labs.convex.dev/better-auth/features/local-install), [AgentMail](https://docs.agentmail.to/api-reference/inboxes/messages/send), [Composio](https://docs.composio.dev/), [HubSpot CRM](https://developers.hubspot.com/docs/api-reference/legacy/crm/search-the-crm), [Retell](https://docs.retellai.com/), [JSON Render](https://json-render.dev/docs/quick-start).
