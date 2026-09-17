import { z } from "zod";
import Retell from "retell-sdk";
import type { Dataset, Action, Connection } from "../domain/schema";
export class ProviderError extends Error {
  constructor(
    public provider: string,
    public status: number,
    message = "Provider operation failed. Check connection health and reconcile before retrying.",
  ) {
    super(message);
  }
}
export async function providerJson<T = Record<string, unknown>>(
  provider: string,
  url: string,
  key: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new ProviderError(
      provider,
      0,
      "Provider did not confirm the result. Reconcile before attempting another operation.",
    );
  }
  if (!response.ok)
    throw new ProviderError(
      provider,
      response.status,
      `${provider} returned HTTP ${response.status}. No provider response body or credentials were logged.`,
    );
  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}
export async function composio<T = Record<string, unknown>>(
  path: string,
  body?: unknown,
): Promise<T> {
  const key = process.env.COMPOSIO_API_KEY;
  if (!key)
    throw new Error("COMPOSIO_API_KEY is not configured on the deployment.");
  return providerJson<T>(
    "Composio",
    `https://backend.composio.dev${path}`,
    "",
    {
      headers: { "x-api-key": key, Authorization: "" },
      ...(body ? { method: "POST", body } : {}),
    },
  );
}
export async function crmProxy<T = Record<string, unknown>>(
  connectedAccountId: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  if (!connectedAccountId)
    throw new Error("A workspace-owned Composio connection is required.");
  const response = await composio<{ data: T; status: number }>(
    "/api/v3/tools/execute/proxy",
    {
      connected_account_id: connectedAccountId,
      endpoint: `https://api.hubapi.com${path}`,
      method,
      ...(body ? { body } : {}),
    },
  );
  if (response.status < 200 || response.status >= 300)
    throw new ProviderError("HubSpot", response.status);
  return response.data;
}
const searchResponse = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      properties: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
});
/** Narrow CRM adapter. The model never receives Composio tool catalogs or OAuth tokens. */
export async function writeCrm(
  state: Dataset,
  action: Action,
  connection: Connection,
  guard: () => Promise<void>,
) {
  const account = state.accounts.find((a) => a.id === action.accountId)!,
    contact = state.contacts.find((c) => c.id === action.contactId),
    connected = connection.providerAccountId!;
  const result = searchResponse.parse(
    await crmProxy(connected, "POST", "/crm/v3/objects/companies/search", {
      filterGroups: [
        {
          filters: [
            { propertyName: "domain", operator: "EQ", value: account.domain },
          ],
        },
      ],
      properties: ["domain", "name", "lifecyclestage"],
      limit: 2,
    }),
  );
  if (result.results.length > 1)
    throw new ProviderError(
      "HubSpot",
      409,
      "Multiple CRM companies match this domain. Resolve the duplicate before writeback.",
    );
  const fields =
    state.crmChanges.find((c) => c.actionId === action.id)?.fields ?? {};
  const companyProperties = {
    name: account.name,
    domain: account.domain,
    ...(fields.lifecyclestage ? { lifecyclestage: fields.lifecyclestage } : {}),
  };
  let companyId = result.results[0]?.id;
  await guard();
  if (companyId)
    await crmProxy(
      connected,
      "PATCH",
      `/crm/v3/objects/companies/${encodeURIComponent(companyId)}`,
      { properties: companyProperties },
    );
  else {
    const created = await crmProxy<{ id: string }>(
      connected,
      "POST",
      "/crm/v3/objects/companies",
      { properties: companyProperties },
    );
    companyId = z.string().parse(created.id);
  }
  if (contact) {
    const existing = searchResponse.parse(
      await crmProxy(connected, "POST", "/crm/v3/objects/contacts/search", {
        filterGroups: [
          {
            filters: [
              { propertyName: "email", operator: "EQ", value: contact.email },
            ],
          },
        ],
        limit: 2,
      }),
    );
    if (existing.results.length > 1)
      throw new ProviderError(
        "HubSpot",
        409,
        "Multiple CRM contacts match this email.",
      );
    await guard();
    if (!existing.results.length)
      await crmProxy(connected, "POST", "/crm/v3/objects/contacts", {
        properties: {
          email: contact.email,
          firstname: contact.name.split(" ")[0],
          lastname: contact.name.split(" ").slice(1).join(" "),
        },
        associations: [
          {
            to: { id: companyId },
            types: [
              { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 1 },
            ],
          },
        ],
      });
  }
  if (fields.opportunity === "create_or_update") {
    if (!connection.mapping?.pipeline || !connection.mapping?.dealstage)
      throw new ProviderError(
        "HubSpot",
        400,
        "Verify deal pipeline mapping before creating an opportunity.",
      );
    const dealname = `Eve · ${account.domain}`;
    const deals = searchResponse.parse(
      await crmProxy(connected, "POST", "/crm/v3/objects/deals/search", {
        filterGroups: [
          {
            filters: [
              { propertyName: "dealname", operator: "EQ", value: dealname },
              {
                propertyName: "pipeline",
                operator: "EQ",
                value: connection.mapping.pipeline,
              },
            ],
          },
        ],
        limit: 2,
      }),
    );
    if (deals.results.length > 1)
      throw new ProviderError(
        "HubSpot",
        409,
        "Resolve duplicate Eve opportunities before writeback.",
      );
    await guard();
    if (!deals.results.length)
      await crmProxy(connected, "POST", "/crm/v3/objects/deals", {
        properties: {
          dealname,
          pipeline: connection.mapping.pipeline,
          dealstage: connection.mapping.dealstage,
          description: `Qualified by Eve. Reference: ${action.idempotencyKey}`,
        },
        associations: [
          {
            to: { id: companyId },
            types: [
              { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 5 },
            ],
          },
        ],
      });
    else
      await crmProxy(
        connected,
        "PATCH",
        `/crm/v3/objects/deals/${encodeURIComponent(deals.results[0].id)}`,
        {
          properties: {
            description: `Updated qualification evidence from Eve. Reference: ${action.idempotencyKey}`,
          },
        },
      );
  }
  const page = state.pageSpecs
    .filter((p) => p.accountId === account.id && p.status === "published")
    .sort((a, b) => b.revision - a.revision)[0];
  const pageLink =
    page && state.workspace.pageBaseUrl
      ? `${state.workspace.pageBaseUrl}/${page.slug}`
      : "";
  const artifact = state.artifacts.find((a) => a.id === action.artifactId)!;
  await guard();
  await crmProxy(connected, "POST", "/crm/v3/objects/notes", {
    properties: {
      hs_timestamp: new Date().toISOString(),
      hs_note_body: `Eve: ${artifact.title.replace(/[<>]/g, "")}\n${artifact.body.replace(/[<>]/g, "")}\n${pageLink}\nReference: ${action.idempotencyKey}`,
    },
    associations: [
      {
        to: { id: companyId },
        types: [
          { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 190 },
        ],
      },
    ],
  });
  return companyId;
}
export async function sendEmail(
  state: Dataset,
  action: Action,
  key: string,
  inboxId: string,
) {
  const artifact = state.artifacts.find((a) => a.id === action.artifactId)!,
    contact = state.contacts.find((c) => c.id === action.contactId)!;
  const result = await providerJson<{ message_id: string; thread_id: string }>(
    "AgentMail",
    `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/messages/send`,
    key,
    {
      method: "POST",
      body: {
        to: [contact.email],
        subject: artifact.title,
        text: artifact.body,
        headers: {
          "X-Eve-Action-Id": action.id,
          "List-Unsubscribe": `<mailto:${inboxId}?subject=unsubscribe>`,
        },
      },
    },
  );
  return z.string().parse(result.message_id);
}
export async function startCall(
  state: Dataset,
  action: Action,
  key: string,
  resourceId: string,
) {
  const contact = state.contacts.find((c) => c.id === action.contactId)!;
  const [agentId, fromNumber] = resourceId.split("|");
  if (!contact.phoneConsent || !contact.phone)
    throw new Error("Calling consent and phone number are required.");
  const client = new Retell({ apiKey: key, maxRetries: 0, timeout: 20000 });
  const result = await client.call.createPhoneCall({
    from_number: fromNumber,
    to_number: contact.phone,
    override_agent_id: agentId,
    metadata: {
      eveWorkspaceId: state.workspace.id,
      eveAccountId: action.accountId,
      eveActionId: action.id,
    },
    retell_llm_dynamic_variables: {
      company_name: state.accounts.find((a) => a.id === action.accountId)!.name,
      approved_call_plan: state.artifacts.find(
        (a) => a.id === action.artifactId,
      )!.body,
    },
  });
  return result.call_id;
}

/** Refresh inbound state directly before dispatch, in addition to signed webhooks. */
export async function recentInboxReply(
  state: Dataset,
  action: Action,
  key: string,
  inboxId: string,
) {
  const contact = state.contacts.find((c) => c.id === action.contactId);
  if (!contact) return null;
  const query = new URLSearchParams({
    senders: contact.email,
    after: new Date(action.createdAt).toISOString(),
    limit: "100",
  });
  const result = await providerJson(
    "AgentMail",
    `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/threads?${query}`,
    key,
  );
  const parsed = z
    .object({
      threads: z.array(
        z.object({
          thread_id: z.string(),
          senders: z.array(z.string()),
          received_timestamp: z.string().optional(),
          preview: z.string().optional(),
        }),
      ),
    })
    .parse(result);
  return (
    parsed.threads.find(
      (t) =>
        t.senders.some(
          (s) =>
            (s.match(/<([^>]+)>/)?.[1] ?? s).toLowerCase() ===
            contact.email.toLowerCase(),
        ) && Date.parse(t.received_timestamp ?? "") >= action.createdAt,
    ) ?? null
  );
}
export async function crmSaysCustomer(state: Dataset, action: Action) {
  const connection = state.connections.find(
    (c) => c.provider === "hubspot" && c.status === "healthy",
  );
  if (!connection?.providerAccountId) return false;
  const account = state.accounts.find((a) => a.id === action.accountId)!;
  const result = searchResponse.parse(
    await crmProxy(
      connection.providerAccountId,
      "POST",
      "/crm/v3/objects/companies/search",
      {
        filterGroups: [
          {
            filters: [
              { propertyName: "domain", operator: "EQ", value: account.domain },
            ],
          },
        ],
        properties: ["lifecyclestage", "hs_lastmodifieddate"],
        limit: 2,
      },
    ),
  );
  if (result.results.length > 1)
    throw new ProviderError(
      "HubSpot",
      409,
      "Company identity is ambiguous in CRM.",
    );
  return result.results.some(
    (c) => c.properties?.lifecyclestage === "customer",
  );
}
