import { datasetSchema, type DemoDataset } from "../domain/schema";
import { createWorkspace } from "../domain/initial-state";
import {
  assertDataset,
  propose,
  proposeActivation,
  proposeCrm,
} from "../domain/engine";

export const DEMO_NOW = Date.UTC(2026, 8, 16, 10, 42);
const HOUR = 3600000,
  DAY = 24 * HOUR;
function createFixture(): DemoDataset {
  const s = createWorkspace(
    "demo-meridian",
    "Meridian",
    {
      id: "demo-operator",
      name: "Alex Morgan",
      email: "alex@meridian.example",
    },
    DEMO_NOW - 14 * DAY,
  );
  const w = s.workspace.id;
  s.workspace.active = true;
  s.workspace.pageBaseUrl = "/preview";
  s.businessProfiles[0] = {
    ...s.businessProfiles[0],
    website: "https://meridian.example",
    description:
      "The API layer for moving product data. Meridian helps engineering teams connect, transform, and sync data with one reliable integration.",
    goal: "Help high-fit teams activate, then convert with confidence",
    icp: "Developer-first B2B software teams with 25–500 employees building data integrations.",
    exclusions: [
      "Agencies and consultancies",
      "Personal email addresses",
      "Existing paid customers",
    ],
    approvedClaims: [
      {
        text: "Meridian’s production quickstart walks through authentication, a first request, and response handling.",
        sourceId: "source-quickstart",
      },
      {
        text: "Team workspaces let developers manage integrations together.",
        sourceId: "source-product",
      },
    ],
    writingRules: [
      "Be useful before being commercial.",
      "Write in short, clear sentences. One primary next step.",
      "Never mention inferred headcount or private product telemetry.",
      "Match the message to the account’s actual stage.",
    ],
    offer: "A complimentary integration walkthrough with an engineer.",
    cta: "https://meridian.example/docs/quickstart",
    confirmed: true,
  };
  s.brandProfiles[0] = {
    ...s.brandProfiles[0],
    name: "Meridian",
    primary: "#285b4e",
    background: "#fafbf7",
    confirmed: true,
  };
  s.knowledgeSources = [
    {
      id: "source-quickstart",
      workspaceId: w,
      title: "Production quickstart",
      kind: "website",
      url: "https://meridian.example/docs/quickstart",
      content:
        "Meridian’s production quickstart walks through authentication, a first request, and response handling. Create an API key, send a request to the production endpoint, and verify the response. Technical help is available by replying to our team.",
      status: "ready",
      createdAt: DEMO_NOW - 12 * DAY,
    },
    {
      id: "source-product",
      workspaceId: w,
      title: "Product & positioning",
      kind: "website",
      url: "https://meridian.example",
      content:
        "Meridian is an API layer for connecting, transforming, and syncing product data. Team workspaces let developers manage integrations together.",
      status: "ready",
      createdAt: DEMO_NOW - 12 * DAY,
    },
    {
      id: "source-playbook",
      workspaceId: w,
      title: "Sales motion & ICP",
      kind: "user",
      content:
        "Assist high-fit teams with activation. Only propose a commercial conversation after successful activation, confirmed pricing activity, and team adoption. Never contact existing customers or agencies.",
      status: "ready",
      createdAt: DEMO_NOW - 10 * DAY,
    },
    {
      id: "source-offer",
      workspaceId: w,
      title: "Approved implementation offer",
      kind: "file",
      content:
        "A complimentary integration walkthrough with an engineer is available to trial teams. No discounts, performance claims, or artificial deadlines are approved.",
      status: "ready",
      createdAt: DEMO_NOW - 10 * DAY,
    },
  ];
  s.knowledgeChunks = s.knowledgeSources.map((x, i) => ({
    id: `chunk-${i}`,
    workspaceId: w,
    sourceId: x.id,
    text: x.content,
    index: 0,
  }));
  s.signalDefinitions = [
    {
      id: "signal-signup",
      workspaceId: w,
      eventName: "user_signed_up",
      label: "New signup",
      meaning: "signup",
      description:
        "A verified work-email signup creates an account to research.",
      confirmed: true,
    },
    {
      id: "signal-activation",
      workspaceId: w,
      eventName: "first_api_request_succeeded",
      label: "Activated",
      meaning: "activation",
      description: "The first successful production API request.",
      confirmed: true,
    },
    {
      id: "signal-friction",
      workspaceId: w,
      eventName: "activation_stalled",
      label: "Activation stalled",
      meaning: "friction",
      description:
        "An explicit server-side check confirms setup is incomplete after 24 hours; missing telemetry alone is never sufficient.",
      confirmed: true,
    },
    {
      id: "signal-pricing",
      workspaceId: w,
      eventName: "pricing_viewed",
      label: "Commercial interest",
      meaning: "intent",
      description:
        "Pricing-page activity after activation; combine with team adoption.",
      confirmed: true,
    },
    {
      id: "signal-team",
      workspaceId: w,
      eventName: "teammate_invited",
      label: "Team adoption",
      meaning: "expansion",
      description: "A teammate joins an activated workspace.",
      confirmed: true,
    },
    {
      id: "signal-usage",
      workspaceId: w,
      eventName: "usage_threshold_reached",
      label: "Expansion potential",
      meaning: "expansion",
      description: "Production usage exceeds 80% of the plan limit.",
      confirmed: false,
    },
  ];
  const companies = [
    {
      id: "acme",
      name: "Acme",
      domain: "acme.example",
      initials: "A",
      color: "violet",
      industry: "Developer tools",
      employees: 84,
      fit: "high",
      observedIntent: "Production setup stalled",
      inferredIntent: "Needs activation help",
      confidence: 0.94,
      stage: "evaluating",
      status: "needs_attention",
      person: "Sarah Chen",
      email: "sarah@acme.example",
      title: "Head of Engineering",
      signal: "activation_stalled",
      ago: 4,
      summary:
        "An engineering-led team building its first production integration. Sarah has set up the workspace and explored the production docs. Help her reach a successful request before discussing a paid plan.",
    },
    {
      id: "orbit",
      name: "Orbit",
      domain: "orbit.example",
      initials: "O",
      color: "blue",
      industry: "B2B SaaS",
      employees: 62,
      fit: "high",
      observedIntent: "Pricing activity + team adoption",
      inferredIntent: "Ready for a conversation",
      confidence: 0.91,
      stage: "qualified",
      status: "needs_attention",
      person: "James Wilson",
      email: "james@orbit.example",
      title: "Co-founder",
      signal: "teammate_invited",
      ago: 12,
      summary:
        "A growing product team with successful production usage and three collaborators. Recent pricing activity supports a timely, helpful plan conversation.",
    },
    {
      id: "layers",
      name: "Layers",
      domain: "layers.example",
      initials: "L",
      color: "peach",
      industry: "Design infrastructure",
      employees: 48,
      fit: "high",
      observedIntent: "First production request",
      inferredIntent: "Activation recovered",
      confidence: 0.98,
      stage: "activated",
      status: "monitoring",
      person: "Mia Foster",
      email: "mia@layers.example",
      title: "Engineering Lead",
      signal: "first_api_request_succeeded",
      ago: 28,
      summary:
        "The team completed its first integration after receiving the production quickstart. The activation follow-up was cancelled.",
    },
    {
      id: "nimbus",
      name: "Nimbus",
      domain: "nimbus.example",
      initials: "N",
      color: "sage",
      industry: "Cloud infrastructure",
      employees: 126,
      fit: "high",
      observedIntent: "Usage approaching plan limit",
      inferredIntent: "Potential expansion",
      confidence: 0.82,
      stage: "activated",
      status: "scheduled",
      person: "Daniel Park",
      email: "daniel@nimbus.example",
      title: "Platform Lead",
      signal: "usage_threshold_reached",
      ago: 41,
      summary:
        "Healthy production usage across the platform team. A scheduled check-in will offer implementation support if the current blocker remains.",
    },
    {
      id: "forma",
      name: "Forma",
      domain: "forma.example",
      initials: "F",
      color: "pink",
      industry: "Product analytics",
      employees: 37,
      fit: "high",
      observedIntent: "Paid upgrade completed",
      inferredIntent: "Customer",
      confidence: 1,
      stage: "customer",
      status: "monitoring",
      person: "Elena Rossi",
      email: "elena@forma.example",
      title: "CTO",
      signal: "upgrade_completed",
      ago: 76,
      summary:
        "The team upgraded after a successful evaluation. All acquisition outreach has stopped; the CRM reflects the conversion.",
    },
    {
      id: "northstar",
      name: "Northstar",
      domain: "northstar.example",
      initials: "✳",
      color: "yellow",
      industry: "AI software",
      employees: 32,
      fit: "high",
      observedIntent: "API key generated",
      inferredIntent: "Exploring the product",
      confidence: 0.65,
      stage: "new",
      status: "working",
      person: "Noah Williams",
      email: "noah@northstar.example",
      title: "Founder",
      signal: "api_key_generated",
      ago: 7,
      summary:
        "A new workspace has started setup. Eve is gathering context and waiting for a confirmed signal before proposing outreach.",
    },
    {
      id: "goodkind",
      name: "Goodkind",
      domain: "goodkind.example",
      initials: "g",
      color: "sage",
      industry: "Commerce software",
      employees: 19,
      fit: "medium",
      observedIntent: "Docs exploration",
      inferredIntent: "Early evaluation",
      confidence: 0.61,
      stage: "evaluating",
      status: "monitoring",
      person: "Olivia King",
      email: "olivia@goodkind.example",
      title: "Product Engineer",
      signal: "docs_viewed",
      ago: 95,
      summary:
        "A small team exploring the documentation. There is not enough evidence for a commercial conversation.",
    },
    {
      id: "monograph",
      name: "Monograph",
      domain: "monograph.example",
      initials: "M",
      color: "gray",
      industry: "Digital agency",
      employees: 42,
      fit: "excluded",
      observedIntent: "New workspace",
      inferredIntent: "Outside ICP",
      confidence: 0.96,
      stage: "new",
      status: "paused",
      person: "Lucas Martin",
      email: "lucas@monograph.example",
      title: "Technical Director",
      signal: "workspace_created",
      ago: 122,
      summary:
        "An agency, excluded by the approved playbook. Eve preserves the event history without planning outreach.",
    },
  ] as const;
  s.accounts = companies.map((c) => ({
    id: c.id,
    workspaceId: w,
    name: c.name,
    domain: c.domain,
    initials: c.initials,
    color: c.color,
    industry: c.industry,
    employees: c.employees,
    fit: c.fit,
    observedIntent: c.observedIntent,
    inferredIntent: c.inferredIntent,
    confidence: c.confidence,
    stage: c.stage,
    status: c.status,
    owner: "Alex Morgan",
    paused: c.fit === "excluded",
    suppressed: c.fit === "excluded",
    lastSignalAt: DEMO_NOW - c.ago * 60000,
    lastSignal: c.signal,
    summary: c.summary,
    contactId: `contact-${c.id}`,
    ...(c.stage === "customer" ? { crmId: `hubspot-${c.id}` } : {}),
  }));
  s.contacts = companies.map((c) => ({
    id: `contact-${c.id}`,
    workspaceId: w,
    accountId: c.id,
    name: c.person,
    email: c.email,
    title: c.title,
    userId: `user-${c.id}`,
    suppressed: c.fit === "excluded",
    phoneConsent: false,
  }));
  s.productWorkspaces = companies.map((c) => ({
    id: `pw-${c.id}`,
    workspaceId: w,
    accountId: c.id,
    externalId: `product-${c.id}`,
    name: `${c.name} production`,
  }));
  s.identities = companies.flatMap((c) =>
    [
      { kind: "domain" as const, value: c.domain },
      { kind: "email" as const, value: c.email },
      { kind: "user" as const, value: `user-${c.id}` },
      { kind: "product_workspace" as const, value: `product-${c.id}` },
    ].map((r, i) => ({
      id: `identity-${c.id}-${i}`,
      workspaceId: w,
      accountId: c.id,
      contactId: `contact-${c.id}`,
      ...r,
    })),
  );
  s.connections = s.connections.map((c) => ({
    ...c,
    status: c.provider === "retell" ? "disconnected" : "healthy",
    scope: "simulated",
    owner: "Meridian · demo account",
    ...(c.provider !== "retell"
      ? {
          providerAccountId: `demo-${c.provider}`,
          resourceId:
            c.provider === "agentmail"
              ? "hello@meridian.example"
              : `demo-${c.provider}`,
          lastSuccessAt: DEMO_NOW - 2 * 60000,
        }
      : {}),
    ...(c.provider === "hubspot"
      ? {
          mapping: {
            company: "domain",
            contact: "email",
            lifecycle: "lifecyclestage",
          },
        }
      : {}),
  }));
  const acmeEvents = [
    "user_signed_up",
    "email_verified",
    "workspace_created",
    "api_key_generated",
    "docs_viewed",
    "activation_stalled",
  ];
  s.productEvents = acmeEvents.map((eventName, i) => ({
    id: `event-acme-${i}`,
    eventId: `acme-${i}`,
    workspaceId: w,
    eventName,
    occurredAt: DEMO_NOW - (i === 5 ? 4 * 60000 : (30 - i) * HOUR),
    userId: "user-acme",
    userEmail: "sarah@acme.example",
    productWorkspaceId: "product-acme",
    companyDomain: "acme.example",
    resolvedAccountId: "acme",
    properties: (i === 4 ? { page: "production-quickstart" } : {}) as Record<
      string,
      string
    >,
  }));
  for (const c of companies.slice(1))
    s.productEvents.push({
      id: `event-${c.id}-latest`,
      eventId: `${c.id}-latest`,
      workspaceId: w,
      eventName: c.signal,
      occurredAt: DEMO_NOW - c.ago * 60000,
      userId: `user-${c.id}`,
      userEmail: c.email,
      resolvedAccountId: c.id,
      companyDomain: c.domain,
      properties: {},
    });
  s.memories = [
    {
      id: "memory-acme-1",
      workspaceId: w,
      accountId: "acme",
      text: "Sarah is leading the production integration evaluation.",
      source: "Signup profile · Sarah Chen",
      confidence: 1,
      kind: "observed",
      createdAt: DEMO_NOW - 30 * HOUR,
    },
    {
      id: "memory-acme-2",
      workspaceId: w,
      accountId: "acme",
      text: "The immediate need appears to be implementation help, not a sales conversation.",
      source:
        "Confirmed activation-stalled signal + production documentation activity",
      confidence: 0.94,
      kind: "inferred",
      createdAt: DEMO_NOW - 4 * 60000,
    },
    {
      id: "memory-acme-3",
      workspaceId: w,
      accountId: "acme",
      text: "Keep this technical. Lead with a working example.",
      source: "Alex Morgan",
      confidence: 1,
      kind: "operator",
      createdAt: DEMO_NOW - HOUR,
    },
  ];
  proposeActivation(s, s.accounts[0], DEMO_NOW - 3 * 60000);
  const orbit = propose(
    s,
    s.accounts[1],
    "email",
    "The next step for your growing team",
    "Hi James,\n\nAs your team starts building together, I can help you choose a plan that fits your integration. Team workspaces let developers manage integrations together.\n\nWould a short setup conversation be useful? Reply here and we can find a time.\n\nAlex at Meridian",
    "Successful production usage, pricing activity, and a new teammate support a plan conversation.",
    DEMO_NOW - 10 * 60000,
    "assisted-conversion",
  );
  orbit.evidenceIds = ["event-orbit-latest"];
  const scheduled = propose(
    s,
    s.accounts[3],
    "email",
    "Check in on the Nimbus integration",
    "Hi Daniel,\n\nIf setup is still blocked, reply with the step that needs a hand. The production quickstart walks through authentication and response handling.\n\nHappy to work through it together.\n\nAlex at Meridian",
    "An operator requested an implementation check-in. Recheck for replies before sending.",
    DEMO_NOW - HOUR,
    "implementation-checkin",
  );
  scheduled.status = "scheduled";
  scheduled.approvedBy = "Alex Morgan";
  scheduled.approvedAt = DEMO_NOW - 30 * 60000;
  scheduled.scheduledAt = DEMO_NOW + 2 * HOUR;
  scheduled.followUp = true;
  s.accounts[3].status = "scheduled";
  const approval = s.approvals.find((a) => a.actionId === scheduled.id)!;
  approval.status = "approved";
  approval.actor = "Alex Morgan";
  approval.resolvedAt = DEMO_NOW - 30 * 60000;
  s.outcomes = [
    {
      id: "outcome-layers",
      workspaceId: w,
      accountId: "layers",
      type: "activated",
      label: "First production request succeeded",
      createdAt: DEMO_NOW - 28 * 60000,
    },
    {
      id: "outcome-forma",
      workspaceId: w,
      accountId: "forma",
      type: "upgrade",
      label: "Converted to the Team plan",
      value: 149,
      createdAt: DEMO_NOW - 76 * 60000,
    },
    {
      id: "outcome-orbit",
      workspaceId: w,
      accountId: "orbit",
      type: "reply",
      label: "Replied to implementation help",
      createdAt: DEMO_NOW - 4 * HOUR,
    },
  ];
  proposeCrm(s, s.accounts[2], DEMO_NOW - 27 * 60000, "activation");
  const crm = s.actions.find(
    (a) => a.accountId === "layers" && a.kind === "crm",
  )!;
  crm.status = "succeeded";
  crm.providerId = "demo-hubspot-layers";
  crm.executedAt = DEMO_NOW - 26 * 60000;
  crm.approvedBy = "Alex Morgan";
  s.crmChanges[0].status = "synced";
  s.crmChanges[0].providerId = "demo-hubspot-layers";
  s.accounts[2].status = "monitoring";
  s.approvals.find((x) => x.actionId === crm.id)!.status = "approved";
  s.agentRuns = [
    {
      id: "run-acme",
      workspaceId: w,
      accountId: "acme",
      status: "waiting",
      summary: "Page and email ready for your review",
      createdAt: DEMO_NOW - 3 * 60000,
    },
    {
      id: "run-northstar",
      workspaceId: w,
      accountId: "northstar",
      status: "running",
      summary: "Gathering company context",
      createdAt: DEMO_NOW - 7 * 60000,
    },
    {
      id: "run-layers",
      workspaceId: w,
      accountId: "layers",
      status: "completed",
      summary: "Activation recorded · CRM updated",
      createdAt: DEMO_NOW - 26 * 60000,
    },
  ];
  s.auditEntries.push(
    ...[
      {
        title: "Activation recovered",
        detail:
          "Layers made its first successful production request. The obsolete follow-up was cancelled.",
        accountId: "layers",
        type: "outcome",
        createdAt: DEMO_NOW - 28 * 60000,
      },
      {
        title: "CRM updated",
        detail:
          "Layers lifecycle state is now active. Writeback confirmed in the simulated HubSpot account.",
        accountId: "layers",
        type: "succeeded",
        createdAt: DEMO_NOW - 26 * 60000,
      },
      {
        title: "New account resolved",
        detail:
          "Northstar’s signup was linked to its company and production workspace.",
        accountId: "northstar",
        type: "signal",
        createdAt: DEMO_NOW - 7 * 60000,
      },
      {
        title: "Production setup stalled",
        detail:
          "An explicit activation check confirmed Acme has not completed setup. Eve prepared implementation help.",
        accountId: "acme",
        type: "signal",
        createdAt: DEMO_NOW - 4 * 60000,
      },
      {
        title: "Customer conversion recorded",
        detail: "Forma upgraded. All acquisition outreach stopped.",
        accountId: "forma",
        type: "outcome",
        createdAt: DEMO_NOW - 76 * 60000,
      },
    ].map((a, i) => ({
      ...a,
      id: `audit-fixture-${i}`,
      workspaceId: w,
      actor: "eve-system",
      policyVersion: 1,
    })),
  );
  return assertDataset(datasetSchema.parse(s));
}
/** The sole canonical demo fixture. No provider clients, keys, or network calls. */
export const demoData: DemoDataset = createFixture();
