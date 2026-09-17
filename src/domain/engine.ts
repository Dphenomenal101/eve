import {
  accountSchema,
  commandSchema,
  datasetSchema,
  eventSchema,
  pageSpecSchema,
  type Account,
  type Action,
  type Artifact,
  type Command,
  type Dataset,
  type Policy,
  type ProductEvent,
  type Role,
} from "./schema";

export class DomainError extends Error {
  constructor(
    message: string,
    public code = "INVALID_OPERATION",
  ) {
    super(message);
    this.name = "DomainError";
  }
}
export const currentPolicy = (s: Dataset): Policy =>
  s.policies[s.policies.length - 1];
export const activeStatuses = new Set<Action["status"]>([
  "draft",
  "pending_approval",
  "approved",
  "scheduled",
]);
export const providerFor = (kind: Action["kind"]) =>
  (
    ({
      email: "agentmail",
      call: "retell",
      crm: "hubspot",
      page: null,
    }) as const
  )[kind];
export function scoped<T extends { id: string; workspaceId: string }>(
  s: Dataset,
  list: T[],
  id: string,
): T {
  const item = list.find(
    (x) => x.id === id && x.workspaceId === s.workspace.id,
  );
  if (!item)
    throw new DomainError(
      "This record is unavailable in your workspace.",
      "NOT_FOUND",
    );
  return item;
}
export function audit(
  s: Dataset,
  title: string,
  detail: string,
  now: number,
  actor = "eve-system",
  accountId?: string,
  actionId?: string,
  type = "operation",
) {
  s.auditEntries.push({
    id: `audit-${now}-${s.auditEntries.length}`,
    workspaceId: s.workspace.id,
    title,
    detail,
    createdAt: now,
    actor,
    policyVersion: currentPolicy(s)?.version ?? 1,
    ...(accountId ? { accountId } : {}),
    ...(actionId ? { actionId } : {}),
    type,
  });
}
export function assertDataset(s: Dataset): Dataset {
  datasetSchema.parse(s);
  for (const [key, rows] of Object.entries(s)) {
    if (!Array.isArray(rows)) continue;
    const ids = new Set<string>();
    for (const row of rows) {
      if (row.workspaceId !== s.workspace.id)
        throw new DomainError(
          `Cross-workspace record in ${key}.`,
          "TENANT_MISMATCH",
        );
      if (ids.has(row.id))
        throw new DomainError(`Duplicate identifier in ${key}.`);
      ids.add(row.id);
    }
  }
  for (const a of s.actions) {
    const account = scoped(s, s.accounts, a.accountId);
    const artifact = scoped(s, s.artifacts, a.artifactId);
    if (artifact.accountId !== account.id || artifact.kind !== a.kind)
      throw new DomainError(
        "Action artifact does not match its account or channel.",
      );
    if (
      a.contactId &&
      scoped(s, s.contacts, a.contactId).accountId !== a.accountId
    )
      throw new DomainError("Contact belongs to another account.");
  }
  return s;
}
export function validatePage(s: Dataset, spec: unknown): string[] {
  const parsed = pageSpecSchema.safeParse(spec);
  if (!parsed.success)
    return ["Page contains an unsupported component or property."];
  const page = parsed.data,
    problems: string[] = [],
    visited = new Set<string>(),
    visiting = new Set<string>();
  if (Object.keys(page.elements).length > 40)
    return ["A page may contain at most 40 components."];
  const walk = (id: string, depth: number) => {
    if (visiting.has(id) || depth > 10) {
      problems.push("Page nesting contains a cycle or is too deep.");
      return;
    }
    if (visited.has(id)) return;
    const element = page.elements[id];
    if (!element) {
      problems.push("Page references a missing component.");
      return;
    }
    visiting.add(id);
    visited.add(id);
    const content = [element.props.text, ...(element.props.items ?? [])].filter(
      Boolean,
    ) as string[];
    if (
      ["Proof", "Offer"].includes(element.type) &&
      content.some(
        (t) =>
          !s.businessProfiles[0].approvedClaims.some(
            (c) =>
              c.text === t && element.props.sourceIds?.includes(c.sourceId),
          ),
      )
    )
      problems.push(
        "Proof and offer text must match an explicitly approved claim.",
      );
    if (
      content.some(
        (t) =>
          /[0-9%$€]/.test(t) &&
          !s.businessProfiles[0].approvedClaims.some((c) => c.text.includes(t)),
      )
    )
      problems.push("Numeric claims need exact approved evidence.");
    const href = element.props.ctaHref;
    if (href && !/^(https:\/\/[^\s]+|mailto:[^\s@]+@[^\s@]+)$/.test(href))
      problems.push("CTA must use an approved HTTPS or email destination.");
    if (href && href !== s.businessProfiles[0]?.cta)
      problems.push("CTA destination has not been approved in the playbook.");
    for (const sourceId of element.props.sourceIds ?? [])
      if (
        !s.knowledgeSources.some(
          (x) => x.id === sourceId && x.status === "ready",
        )
      )
        problems.push("Page claim has an unavailable source.");
    if (
      ["Proof", "Offer"].includes(element.type) &&
      !element.props.sourceIds?.length
    )
      problems.push("Proof and offers require approved sources.");
    for (const child of element.children ?? []) walk(child, depth + 1);
    visiting.delete(id);
  };
  walk(page.root, 0);
  if (visited.size !== Object.keys(page.elements).length)
    problems.push("Page contains unreachable components.");
  return [...new Set(problems)];
}
export function writingGate(s: Dataset, artifact: Artifact): string[] {
  const issues: string[] = [],
    profile = s.businessProfiles[0];
  const text = `${artifact.title}\n${artifact.body}`.toLowerCase();
  for (const phrase of profile.prohibitedPhrases)
    if (text.includes(phrase.toLowerCase()))
      issues.push(`Remove prohibited phrase: “${phrase}”.`);
  if (/\{\{|\[insert|\[name\]|\[company\]|lorem ipsum|\bTBD\b/i.test(text))
    issues.push("Draft contains a placeholder.");
  if (!artifact.reasonNow.trim()) issues.push("Add a clear reason to act now.");
  if (!artifact.cta.trim()) issues.push("Include one clear next step.");
  if (
    !artifact.sourceIds.length ||
    artifact.sourceIds.some(
      (id) =>
        !s.knowledgeSources.some((x) => x.id === id && x.status === "ready"),
    )
  )
    issues.push("Claims need available, approved sources.");
  if ((artifact.body.match(/https?:\/\/[^\s]+/g) ?? []).length > 1)
    issues.push("Use only one primary link.");
  if (artifact.body.length > 2500)
    issues.push("Keep the message under 2,500 characters.");
  return issues;
}
export type Preflight = {
  allowed: boolean;
  reason?: string;
  disposition?: "cancel" | "wait" | "reapprove" | "expire";
};
export function preflight(s: Dataset, a: Action, now: number): Preflight {
  if (a.workspaceId !== s.workspace.id)
    return {
      allowed: false,
      reason: "Workspace mismatch.",
      disposition: "cancel",
    };
  const p = currentPolicy(s),
    account = scoped(s, s.accounts, a.accountId),
    artifact = scoped(s, s.artifacts, a.artifactId);
  const deny = (
    reason: string,
    disposition: Preflight["disposition"] = "cancel",
  ): Preflight => ({ allowed: false, reason, disposition });
  if (!s.businessProfiles[0]?.confirmed)
    return deny("Confirm the business brief before execution.", "wait");
  if (
    s.actions.some(
      (x) =>
        x.id !== a.id &&
        x.accountId === a.accountId &&
        x.kind === a.kind &&
        x.status === "executing",
    )
  )
    return deny(
      "Another operation for this account and channel is executing.",
      "wait",
    );
  if (
    a.requiredPageId &&
    !s.pageSpecs.some(
      (p) => p.id === a.requiredPageId && p.status === "published",
    )
  )
    return deny(
      "Publish the reviewed personalized page before sending its link.",
      "wait",
    );
  if (!s.workspace.active) return deny("Workspace is not active.", "wait");
  if (s.workspace.paused || account.paused || p.pausedChannels.includes(a.kind))
    return deny("Processing is paused.", "wait");
  if (a.expiresAt <= now)
    return deny("The approval or timing window has expired.", "expire");
  if (a.policyVersion !== p.version)
    return deny(
      "Policy changed. Review this action under the current policy.",
      "reapprove",
    );
  const mode = p.overrides[a.kind] ?? p.mode;
  if (mode === "observe")
    return deny("Observe mode permits drafts only.", "wait");
  if (mode === "copilot" && !a.approvedBy)
    return deny("Human approval is required.", "reapprove");
  if (a.scheduledAt && a.scheduledAt > now)
    return deny("Scheduled for later.", "wait");
  if (a.kind !== "crm") {
    if (
      p.minEmployees > 0 &&
      (account.employees === undefined || account.employees < p.minEmployees)
    )
      return deny(
        "Verified company size does not meet the current eligibility policy.",
        "wait",
      );
    if (p.requireIntent && account.stage !== "qualified")
      return deny(
        "Current policy requires confirmed commercial intent.",
        "wait",
      );
    if (account.suppressed || account.fit === "excluded")
      return deny("The account is suppressed or excluded.");
    const contact = a.contactId
      ? scoped(s, s.contacts, a.contactId)
      : undefined;
    if (contact?.suppressed) return deny("The contact has unsubscribed.");
    if (account.stage === "customer" || account.stage === "closed")
      return deny("Account is already a customer or closed.");
    if (account.lastReplyAt && account.lastReplyAt >= a.createdAt - 1)
      return deny("A reply made this follow-up obsolete.");
    if (
      s.outcomes.some(
        (o) =>
          o.accountId === account.id &&
          ["booking", "upgrade"].includes(o.type) &&
          o.createdAt >= a.createdAt,
      )
    )
      return deny("A booking or conversion made this action obsolete.");
    if (["email", "call"].includes(a.kind)) {
      if (!contact) return deny("A verified contact is required.");
      if (a.kind === "call" && (!contact.phone || !contact.phoneConsent))
        return deny(
          "A phone number and recorded calling consent are required.",
        );
      const hour = Number(
        new Intl.DateTimeFormat("en", {
          hour: "numeric",
          hourCycle: "h23",
          timeZone: s.workspace.timezone,
        }).format(now),
      );
      const quiet =
        p.quietStart === p.quietEnd
          ? false
          : p.quietStart > p.quietEnd
            ? hour >= p.quietStart || hour < p.quietEnd
            : hour >= p.quietStart && hour < p.quietEnd;
      if (quiet) return deny("Workspace quiet hours are in effect.", "wait");
      const sent = s.actions.filter(
        (x) =>
          ["succeeded", "executing"].includes(x.status) &&
          ["email", "call"].includes(x.kind) &&
          x.id !== a.id &&
          (x.executedAt ?? x.scheduledAt ?? x.createdAt) > now - 86400000,
      );
      if (
        sent.filter((x) => x.accountId === account.id).length >=
          p.maxAccountPerDay ||
        sent.filter((x) => x.contactId === a.contactId).length >=
          p.maxContactPerDay
      )
        return deny(
          "The daily contact or account limit has been reached.",
          "wait",
        );
      const writing = writingGate(s, artifact);
      if (writing.length) return deny(writing.join(" "), "reapprove");
    }
  }
  if (a.kind === "page") {
    const page = s.pageSpecs.find((x) => x.artifactId === a.artifactId);
    if (!page) return deny("No page specification is available.", "reapprove");
    const problems = validatePage(s, page.spec);
    if (problems.length) return deny(problems.join(" "), "reapprove");
    if (
      !s.brandProfiles.find((b) => b.version === page.brandVersion)?.confirmed
    )
      return deny("Confirm the brand before publishing.", "reapprove");
  }
  if (a.kind === "crm") {
    const desired =
      account.stage === "customer"
        ? "customer"
        : account.stage === "qualified"
          ? "salesqualifiedlead"
          : "lead";
    const change = s.crmChanges.find((c) => c.actionId === a.id);
    if (
      change?.fields.lifecyclestage &&
      change.fields.lifecyclestage !== desired
    )
      return deny("A newer account lifecycle made this CRM update obsolete.");
  }
  const provider = providerFor(a.kind);
  if (
    provider &&
    !s.connections.some(
      (c) => c.provider === provider && c.status === "healthy",
    )
  )
    return deny("The required connection is unavailable.", "wait");
  if (
    s.actions.some(
      (x) =>
        x.id !== a.id &&
        x.idempotencyKey === a.idempotencyKey &&
        ["succeeded", "executing"].includes(x.status),
    )
  )
    return deny("This operation has already been claimed or completed.");
  return { allowed: true };
}
function refreshStatus(s: Dataset, accountId: string) {
  const a = scoped(s, s.accounts, accountId),
    actions = s.actions.filter((x) => x.accountId === accountId);
  a.status = a.paused
    ? "paused"
    : actions.some((x) => x.status === "pending_approval")
      ? "needs_attention"
      : actions.some((x) => x.status === "executing")
        ? "working"
        : actions.some((x) => x.status === "scheduled")
          ? "scheduled"
          : "monitoring";
  const run = s.agentRuns.find((r) => r.accountId === accountId);
  if (run) {
    run.status =
      a.status === "working"
        ? "running"
        : ["needs_attention", "scheduled", "paused"].includes(a.status)
          ? "waiting"
          : "completed";
    run.summary =
      a.status === "needs_attention"
        ? "Prepared actions are ready for review"
        : a.status === "scheduled"
          ? "Approved work is waiting for its scheduled time"
          : a.status === "paused"
            ? "Account processing is paused"
            : a.status === "working"
              ? "Executing an approved action"
              : "Watching for the next confirmed signal";
  }
}
export function cancelStale(
  s: Dataset,
  accountId: string,
  reason: string,
  now: number,
  outreachOnly = true,
) {
  for (const a of s.actions)
    if (
      a.accountId === accountId &&
      activeStatuses.has(a.status) &&
      (!outreachOnly || a.kind !== "crm")
    ) {
      a.status = "cancelled";
      a.cancellationReason = reason;
      for (const approval of s.approvals.filter(
        (x) => x.actionId === a.id && x.status === "pending",
      )) {
        approval.status = "expired";
        approval.resolvedAt = now;
      }
      audit(
        s,
        "Obsolete action cancelled",
        `${a.title}: ${reason}`,
        now,
        "eve-system",
        accountId,
        a.id,
        "cancelled",
      );
    }
  refreshStatus(s, accountId);
}
export function propose(
  s: Dataset,
  account: Account,
  kind: Action["kind"],
  title: string,
  body: string,
  reason: string,
  now: number,
  key: string,
): Action {
  const existing = s.actions.find(
    (x) => x.idempotencyKey === `${s.workspace.id}:${account.id}:${key}`,
  );
  if (existing) return existing;
  const p = currentPolicy(s),
    id = `action-${account.id}-${key}`,
    artifactId = `artifact-${account.id}-${key}`,
    mode = p.overrides[kind] ?? p.mode;
  const sourceIds = s.businessProfiles[0].approvedClaims.map((x) => x.sourceId);
  const artifact: Artifact = {
    id: artifactId,
    workspaceId: s.workspace.id,
    accountId: account.id,
    kind,
    title,
    body,
    revision: 1,
    sourceIds: [...new Set(sourceIds)],
    reasonNow: reason,
    cta: s.businessProfiles[0].cta,
    createdAt: now,
  };
  const action: Action = {
    id,
    workspaceId: s.workspace.id,
    accountId: account.id,
    ...(account.contactId ? { contactId: account.contactId } : {}),
    artifactId,
    kind,
    title,
    status:
      mode === "observe"
        ? "draft"
        : mode === "copilot"
          ? "pending_approval"
          : "scheduled",
    rationale: reason,
    evidenceIds: s.productEvents
      .filter((x) => x.resolvedAccountId === account.id)
      .slice(-6)
      .map((x) => x.id),
    policyVersion: p.version,
    createdAt: now,
    scheduledAt: now,
    expiresAt: now + p.approvalTtlHours * 3600000,
    idempotencyKey: `${s.workspace.id}:${account.id}:${key}`,
    attempts: 0,
    followUp: false,
    retrySafe: false,
  };
  s.artifacts.push(artifact);
  s.actions.push(action);
  if (action.status === "pending_approval")
    s.approvals.push({
      id: `approval-${id}`,
      workspaceId: s.workspace.id,
      actionId: id,
      status: "pending",
      createdAt: now,
    });
  audit(
    s,
    `${kind === "crm" ? "CRM update" : kind === "page" ? "Personalized page" : "Helpful outreach"} prepared`,
    reason,
    now,
    "eve-system",
    account.id,
    id,
    "proposed",
  );
  refreshStatus(s, account.id);
  return action;
}
export function proposeActivation(
  s: Dataset,
  account: Account,
  now: number,
  includeEmail = true,
) {
  const contact = s.contacts.find((x) => x.id === account.contactId),
    first = contact?.name.split(" ")[0] ?? "there",
    profile = s.businessProfiles[0];
  const reason = !includeEmail
    ? "A confirmed signup supports a useful starting page; it does not establish buying intent."
    : "Production setup activity and a confirmed activation-stalled signal suggest implementation help would be useful. There is no evidence of buying intent yet.";
  const pageAction = propose(
    s,
    account,
    "page",
    `A starting point for ${account.name}`,
    "A focused implementation guide with the approved production quickstart.",
    reason,
    now,
    "activation-page",
  );
  if (!s.pageSpecs.some((x) => x.artifactId === pageAction.artifactId)) {
    s.pageSpecs.push({
      id: `page-${account.id}-1`,
      workspaceId: s.workspace.id,
      accountId: account.id,
      artifactId: pageAction.artifactId,
      slug: `${s.workspace.id}-${account.id}-getting-started`,
      revision: 1,
      brandVersion: s.brandProfiles.at(-1)!.version,
      policyVersion: currentPolicy(s).version,
      status: "validated",
      createdAt: now,
      spec: {
        root: "root",
        elements: {
          root: {
            type: "Stack",
            props: {},
            children: ["hero", "context", "steps", "cta", "footer"],
          },
          hero: {
            type: "Hero",
            props: {
              eyebrow: `${profile.name} × ${account.name}`,
              title: `Your first production request.\nA clear path from here.`,
              text: `A focused starting point for the ${account.name} team. Get your integration running, then build at your own pace.`,
              tone: "accent",
            },
          },
          context: {
            type: "ContextBanner",
            props: {
              title: "From setup to something working",
              text: profile.approvedClaims[0]?.text ?? profile.description,
              sourceIds: profile.approvedClaims.map((c) => c.sourceId),
            },
          },
          steps: {
            type: "Steps",
            props: {
              title: "Three steps to your first request",
              items: [
                "Create a production API key in your workspace.",
                "Use the quickstart to make a small, successful request.",
                "Check the response and move your integration into production.",
              ],
            },
          },
          cta: {
            type: "CTA",
            props: {
              title: "Build your first integration",
              text: "Start small. We’re here if you get stuck.",
              ctaLabel: "Open the quickstart",
              ctaHref: profile.cta,
            },
          },
          footer: {
            type: "Footer",
            props: {
              text: `Prepared for ${account.name} by ${profile.name}. Personalized with Eve.`,
            },
          },
        },
      },
    });
  }
  if (!includeEmail) return;
  const page = s.pageSpecs.find((p) => p.artifactId === pageAction.artifactId)!;
  const destination = s.workspace.pageBaseUrl
    ? `${s.workspace.pageBaseUrl}/${page.slug}`
    : profile.cta;
  const emailAction = propose(
    s,
    account,
    "email",
    `A quickstart for your ${profile.name} integration`,
    `Hi ${first},\n\nGetting the first production request working is the useful next step. I put together a short starting point for your team, with the production quickstart and a simple path through setup.\n\n${profile.approvedClaims[0]?.text ?? "The quickstart explains how to make your first request."}\n\nStart here: ${destination}\n\nIf anything gets in the way, reply here and I’ll help.\n\nThe ${profile.name} team`,
    reason,
    now,
    "activation-email",
  );
  if (s.workspace.pageBaseUrl) emailAction.requiredPageId = page.id;
}
export function ingest(
  input: Dataset,
  raw: ProductEvent,
  now: number,
): { state: Dataset; duplicate: boolean; accountId?: string } {
  const e = eventSchema.parse(raw),
    s = structuredClone(input);
  if (e.workspaceId !== s.workspace.id)
    throw new DomainError(
      "Event workspace does not match its ingestion credential.",
      "TENANT_MISMATCH",
    );
  if (s.productEvents.some((x) => x.eventId === e.eventId))
    return { state: input, duplicate: true };
  if (e.occurredAt > now + 300000 || e.occurredAt < now - 90 * 86400000)
    throw new DomainError(
      "Event timestamp must be within the last 90 days and no more than 5 minutes ahead.",
    );
  if (
    Object.keys(e.properties).some((k) =>
      /password|secret|token|api.?key|request.?body|payload|credit.?card|ssn/i.test(
        k,
      ),
    )
  )
    throw new DomainError("Event includes a prohibited sensitive property.");
  const domain = (e.companyDomain ?? e.userEmail?.split("@")[1])
    ?.toLowerCase()
    .replace(/^www\./, "");
  if (domain && !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(domain))
    throw new DomainError("Company domain is invalid.");
  const refs = [
    { kind: "user", value: e.userId },
    { kind: "email", value: e.userEmail?.toLowerCase() },
    { kind: "product_workspace", value: e.productWorkspaceId },
    ...(!domain ||
    ["gmail.com", "outlook.com", "yahoo.com", "hotmail.com"].includes(domain)
      ? []
      : [{ kind: "domain", value: domain }]),
  ];
  const matches = new Set(
    refs.flatMap((ref) =>
      ref.value
        ? s.identities
            .filter((x) => x.kind === ref.kind && x.value === ref.value)
            .map((x) => x.accountId)
        : [],
    ),
  );
  if (e.accountId) matches.add(scoped(s, s.accounts, e.accountId).id);
  if (matches.size > 1)
    throw new DomainError(
      "Identity fields refer to different accounts. Resolve the mapping before processing.",
      "IDENTITY_CONFLICT",
    );
  let account = s.accounts.find((x) => x.id === [...matches][0]);
  if (
    !account &&
    domain &&
    !["gmail.com", "outlook.com", "yahoo.com", "hotmail.com"].includes(domain)
  ) {
    const id = `account-${domain.replace(/[^a-z0-9]/g, "-")}`,
      name = domain.split(".")[0];
    account = accountSchema.parse({
      id,
      workspaceId: s.workspace.id,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      domain,
      initials: name.slice(0, 2).toUpperCase(),
      color: "sage",
      industry: "Not yet enriched",
      fit: "unknown",
      observedIntent: "New signup",
      inferredIntent: "Insufficient evidence",
      confidence: 0,
      stage: "new",
      status: "monitoring",
      owner: "Unassigned",
      paused: false,
      suppressed: false,
      lastSignalAt: e.occurredAt,
      lastSignal: e.eventName,
      summary: "A new account. Awaiting verified business context.",
    });
    s.accounts.push(account);
  }
  s.productEvents.push({
    ...e,
    id: `event-${e.eventId}`,
    ...(account ? { resolvedAccountId: account.id } : {}),
  });
  if (!account) {
    audit(
      s,
      "Event needs identity",
      `${e.eventName} was received, but no company account could be resolved.`,
      now,
      "eve-system",
      undefined,
      undefined,
      "identity",
    );
    return { state: s, duplicate: false };
  }
  if (
    e.userEmail &&
    !s.contacts.some(
      (c) =>
        c.accountId === account!.id &&
        c.email.toLowerCase() === e.userEmail!.toLowerCase(),
    )
  ) {
    const id = `contact-${account.id}-${s.contacts.length}`;
    s.contacts.push({
      id,
      workspaceId: s.workspace.id,
      accountId: account.id,
      name:
        typeof e.properties.name === "string"
          ? e.properties.name
          : e.userEmail.split("@")[0],
      email: e.userEmail.toLowerCase(),
      title:
        typeof e.properties.title === "string"
          ? e.properties.title
          : "Product user",
      userId: e.userId ?? e.userEmail.toLowerCase(),
      suppressed: false,
      phoneConsent: false,
    });
    account.contactId ??= id;
  }
  for (const ref of refs)
    if (
      ref.value &&
      !s.identities.some((x) => x.kind === ref.kind && x.value === ref.value)
    )
      s.identities.push({
        id: `identity-${s.identities.length}`,
        workspaceId: s.workspace.id,
        accountId: account.id,
        ...(account.contactId ? { contactId: account.contactId } : {}),
        kind: ref.kind as "user" | "email" | "product_workspace" | "domain",
        value: ref.value,
      });
  if (
    e.productWorkspaceId &&
    !s.productWorkspaces.some((x) => x.externalId === e.productWorkspaceId)
  )
    s.productWorkspaces.push({
      id: `pw-${e.productWorkspaceId}`,
      workspaceId: s.workspace.id,
      accountId: account.id,
      externalId: e.productWorkspaceId,
      name: account.name,
    });
  if (e.occurredAt >= account.lastSignalAt) {
    account.lastSignal = e.eventName;
    account.lastSignalAt = e.occurredAt;
  }
  audit(
    s,
    "Product signal received",
    e.eventName.replaceAll("_", " "),
    now,
    "eve-system",
    account.id,
    undefined,
    "signal",
  );
  const signal = s.signalDefinitions.find(
    (x) => x.eventName === e.eventName && x.confirmed,
  );
  if (
    signal?.meaning === "signup" &&
    s.businessProfiles[0].pageStrategy === "immediate" &&
    !account.suppressed
  )
    proposeActivation(s, account, now, false);
  if (signal?.meaning === "activation" || e.eventName === "upgrade_completed") {
    const customer = e.eventName === "upgrade_completed";
    if (account.stage !== "customer")
      account.stage = customer ? "customer" : "activated";
    account.observedIntent = customer
      ? "Paid upgrade completed"
      : "First production request succeeded";
    account.inferredIntent = customer ? "Customer" : "Ready to build";
    cancelStale(
      s,
      account.id,
      customer
        ? "The account converted to paid."
        : "The activation blocker is resolved.",
      now,
    );
    if (
      !s.outcomes.some(
        (o) =>
          o.accountId === account!.id &&
          o.type === (customer ? "upgrade" : "activated"),
      )
    )
      s.outcomes.push({
        id: `outcome-${e.eventId}`,
        workspaceId: s.workspace.id,
        accountId: account.id,
        type: customer ? "upgrade" : "activated",
        label: customer ? "Converted to paid" : "Activation recovered",
        createdAt: now,
      });
    proposeCrm(s, account, now, e.eventId);
  } else if (
    signal?.meaning === "friction" &&
    !["activated", "qualified", "customer", "closed"].includes(account.stage)
  ) {
    account.stage = "evaluating";
    account.observedIntent = signal.label;
    account.inferredIntent = "Needs activation help";
    account.confidence = 0.89;
    if (account.fit !== "excluded" && !account.suppressed)
      proposeActivation(s, account, now);
  } else if (
    signal &&
    ["intent", "expansion"].includes(signal.meaning) &&
    ["activated", "qualified"].includes(account.stage)
  ) {
    const events = s.productEvents.filter(
      (x) =>
        x.resolvedAccountId === account!.id &&
        x.occurredAt >= now - 7 * 86400000,
    );
    const meanings = new Set(
      events.flatMap((x) =>
        s.signalDefinitions
          .filter((d) => d.eventName === x.eventName && d.confirmed)
          .map((d) => d.meaning),
      ),
    );
    if (meanings.has("intent") && meanings.has("expansion")) {
      account.stage = "qualified";
      account.observedIntent = "Pricing activity + team adoption";
      account.inferredIntent = "Assisted conversion opportunity";
      account.confidence = 0.91;
      propose(
        s,
        account,
        "email",
        "A plan for your growing team",
        `Hi ${s.contacts.find((x) => x.id === account!.contactId)?.name.split(" ")[0] ?? "there"},\n\nAs your team starts building together, I can help you choose a plan that fits your integration.\n\n${s.businessProfiles[0].approvedClaims[0]?.text ?? s.businessProfiles[0].description}\n\nWould a short setup conversation be useful? Reply here and we can find a time.\n\nThe ${s.businessProfiles[0].name} team`,
        "Confirmed pricing activity and team adoption follow successful activation.",
        now,
        "assisted-conversion",
      );
      proposeCrm(s, account, now, "qualified");
    }
  }
  refreshStatus(s, account.id);
  return { state: assertDataset(s), duplicate: false, accountId: account.id };
}
export function proposeCrm(
  s: Dataset,
  account: Account,
  now: number,
  key: string,
) {
  const a = propose(
    s,
    account,
    "crm",
    `Update ${account.name} in CRM`,
    `Lifecycle stage → ${account.stage}\nLatest signal → ${account.lastSignal}${account.stage === "qualified" ? "\nOpportunity → find or create a deal in the connected pipeline" : ""}\nActivity note → include the latest published Eve page, if available`,
    "Keep the CRM aligned with the latest verified account outcome.",
    now,
    `crm-${key}`,
  );
  if (!s.crmChanges.some((x) => x.actionId === a.id))
    s.crmChanges.push({
      id: `crm-${a.id}`,
      workspaceId: s.workspace.id,
      accountId: account.id,
      actionId: a.id,
      fields: {
        ...(account.stage === "qualified"
          ? { opportunity: "create_or_update" }
          : {}),
        lifecyclestage:
          account.stage === "customer"
            ? "customer"
            : account.stage === "qualified"
              ? "salesqualifiedlead"
              : "lead",
      },
      status: "proposed",
      createdAt: now,
    });
}
export function recordOutcome(
  input: Dataset,
  accountId: string,
  type: "reply" | "booking" | "unsubscribe",
  text: string,
  key: string,
  now: number,
  channel: "email" | "call" = "email",
): Dataset {
  const s = structuredClone(input),
    account = scoped(s, s.accounts, accountId);
  if (s.outcomes.some((o) => o.id === `outcome-${key}`)) return input;
  s.outcomes.push({
    id: `outcome-${key}`,
    workspaceId: s.workspace.id,
    accountId,
    type,
    label:
      type === "reply"
        ? "Prospect replied"
        : type === "booking"
          ? "Meeting booked"
          : "Unsubscribed",
    createdAt: now,
  });
  if (type === "unsubscribe") {
    account.suppressed = true;
    for (const contact of s.contacts.filter((c) => c.accountId === accountId))
      contact.suppressed = true;
  } else {
    account.lastReplyAt = now;
    s.conversations.push({
      id: `conversation-${key}`,
      workspaceId: s.workspace.id,
      accountId,
      channel,
      direction: "inbound",
      text,
      createdAt: now,
    });
  }
  cancelStale(
    s,
    accountId,
    type === "unsubscribe"
      ? "Contact unsubscribed. Approval cannot override suppression."
      : `Prospect ${type === "reply" ? "replied" : "booked a meeting"}.`,
    now,
  );
  audit(
    s,
    type === "unsubscribe" ? "Contact suppressed" : "Conversation updated",
    text,
    now,
    "provider-webhook",
    accountId,
    undefined,
    "outcome",
  );
  proposeCrm(s, account, now, key);
  return assertDataset(s);
}
export function applyCommand(
  input: Dataset,
  raw: Command,
  actor: { id: string; role: Role },
  now: number,
): Dataset {
  const cmd = commandSchema.parse(raw),
    s = structuredClone(input);
  if (actor.role === "viewer")
    throw new DomainError(
      "Viewers cannot change workspace state.",
      "FORBIDDEN",
    );
  if (
    [
      "authority",
      "business",
      "brand",
      "signal",
      "knowledge",
      "propose_policy",
      "resolve_policy",
      "disconnect",
      "activate",
    ].includes(cmd.type) &&
    !["owner", "admin"].includes(actor.role)
  )
    throw new DomainError(
      "This change requires an owner or admin.",
      "FORBIDDEN",
    );
  if (cmd.type === "pause") {
    if (cmd.accountId) {
      const a = scoped(s, s.accounts, cmd.accountId);
      a.paused = cmd.paused;
      refreshStatus(s, a.id);
    } else s.workspace.paused = cmd.paused;
    audit(
      s,
      cmd.paused ? "Processing paused" : "Processing resumed",
      cmd.accountId
        ? "Account-specific pause updated."
        : "Workspace-wide pause updated.",
      now,
      actor.id,
      cmd.accountId,
    );
  } else if (cmd.type === "authority") {
    const p = currentPolicy(s);
    s.workspace.mode = cmd.mode;
    s.policies.push({
      ...p,
      id: `policy-${p.version + 1}`,
      version: p.version + 1,
      mode: cmd.mode,
      overrides: cmd.overrides ?? p.overrides,
      createdAt: now,
      actor: actor.id,
    });
    for (const a of s.actions.filter((a) => activeStatuses.has(a.status))) {
      a.status = cmd.mode === "observe" ? "draft" : "pending_approval";
      delete a.approvedBy;
      delete a.approvedAt;
    }
    audit(
      s,
      "Authority updated",
      `Default mode is now ${cmd.mode}. Existing actions require review.`,
      now,
      actor.id,
      undefined,
      undefined,
      "policy",
    );
  } else if (
    ["approve", "reject", "cancel", "schedule", "edit"].includes(cmd.type)
  ) {
    const c = cmd as Extract<Command, { actionId: string }>,
      a = scoped(s, s.actions, c.actionId);
    if (!activeStatuses.has(a.status))
      throw new DomainError(
        `This action is ${a.status} and can no longer be changed.`,
      );
    if (c.type === "approve") {
      const mode = currentPolicy(s).overrides[a.kind] ?? currentPolicy(s).mode;
      if (mode === "observe")
        throw new DomainError(
          "Switch to Copilot before approving external actions.",
        );
      if (a.expiresAt <= now)
        throw new DomainError(
          "This action has expired. Generate a fresh recommendation.",
        );
      a.policyVersion = currentPolicy(s).version;
      a.approvedBy = actor.id;
      a.approvedAt = now;
      a.status = "scheduled";
      a.scheduledAt = Math.max(now, a.scheduledAt ?? now);
      const existing = s.approvals.find(
        (x) => x.actionId === a.id && x.status === "pending",
      );
      if (existing) {
        existing.status = "approved";
        existing.actor = actor.id;
        existing.resolvedAt = now;
      } else
        s.approvals.push({
          id: `approval-${a.id}-${s.approvals.length}`,
          workspaceId: s.workspace.id,
          actionId: a.id,
          status: "approved",
          actor: actor.id,
          createdAt: now,
          resolvedAt: now,
        });
      audit(
        s,
        "Action approved",
        `${a.title}. Execution will recheck current policy and account state.`,
        now,
        actor.id,
        a.accountId,
        a.id,
        "approval",
      );
    } else if (c.type === "reject" || c.type === "cancel") {
      a.status = c.type === "reject" ? "rejected" : "cancelled";
      a.cancellationReason = c.reason;
      for (const p of s.approvals.filter(
        (x) => x.actionId === a.id && x.status === "pending",
      )) {
        p.status = "rejected";
        p.actor = actor.id;
        p.note = c.reason;
        p.resolvedAt = now;
      }
      audit(
        s,
        `Action ${a.status}`,
        c.reason,
        now,
        actor.id,
        a.accountId,
        a.id,
      );
    } else if (c.type === "schedule") {
      if (c.scheduledAt <= now || c.scheduledAt >= a.expiresAt)
        throw new DomainError(
          "Choose a future time within the action’s approval window.",
        );
      a.scheduledAt = c.scheduledAt;
      a.status = a.approvedBy ? "scheduled" : "pending_approval";
      audit(
        s,
        "Action rescheduled",
        new Date(c.scheduledAt).toISOString(),
        now,
        actor.id,
        a.accountId,
        a.id,
      );
    } else if (c.type === "edit") {
      if (a.kind === "page" || a.kind === "crm")
        throw new DomainError(
          "Pages must be revised through the validated page generator.",
        );
      const artifact = scoped(s, s.artifacts, a.artifactId),
        revised = {
          ...artifact,
          id: `${artifact.id}-r${artifact.revision + 1}`,
          revision: artifact.revision + 1,
          title: c.title,
          body: c.body,
          createdAt: now,
        };
      s.artifacts.push(revised);
      a.artifactId = revised.id;
      a.title = c.title;
      a.status = "pending_approval";
      delete a.approvedBy;
      delete a.approvedAt;
      audit(
        s,
        "Artifact revised",
        `Revision ${revised.revision}; previous approval invalidated.`,
        now,
        actor.id,
        a.accountId,
        a.id,
        "revision",
      );
    }
    refreshStatus(s, a.accountId);
  } else if (cmd.type === "memory") {
    scoped(s, s.accounts, cmd.accountId);
    s.memories.push({
      id: `memory-${now}-${s.memories.length}`,
      workspaceId: s.workspace.id,
      accountId: cmd.accountId,
      text: cmd.text,
      source: actor.id,
      confidence: 1,
      kind: "operator",
      createdAt: now,
    });
    audit(s, "Account memory updated", cmd.text, now, actor.id, cmd.accountId);
  } else if (cmd.type === "prepare_call") {
    const account = scoped(s, s.accounts, cmd.accountId),
      contact = scoped(s, s.contacts, account.contactId ?? "");
    contact.phone = cmd.phone;
    contact.phoneConsent = true;
    audit(
      s,
      "Calling consent recorded",
      cmd.consentNote,
      now,
      actor.id,
      account.id,
    );
    propose(
      s,
      account,
      "call",
      `Implementation conversation with ${account.name}`,
      `Introduce yourself as an AI assistant calling for ${s.businessProfiles[0].name}. Confirm this is still a good time. Offer implementation help. ${s.businessProfiles[0].approvedClaims[0]?.text ?? ""} Ask whether a setup conversation would be useful. Respect a request to stop immediately.`,
      "An operator recorded consent and requested an implementation conversation.",
      now,
      `call-${now}`,
    );
  } else if (cmd.type === "unpublish") {
    const page = scoped(s, s.pageSpecs, cmd.pageId);
    for (const revision of s.pageSpecs.filter((p) => p.slug === page.slug))
      revision.status = "unpublished";
    audit(
      s,
      "Page unpublished",
      "The public page is no longer available.",
      now,
      actor.id,
      page.accountId,
    );
  } else if (cmd.type === "customer") {
    const a = scoped(s, s.accounts, cmd.accountId);
    a.stage = "customer";
    cancelStale(
      s,
      a.id,
      "Operator confirmed this account is already a customer.",
      now,
    );
    audit(
      s,
      "Account marked as customer",
      "Future acquisition outreach is suppressed.",
      now,
      actor.id,
      a.id,
    );
    proposeCrm(s, a, now, `customer-${now}`);
  } else if (cmd.type === "business") {
    if (cmd.profile.workspaceId !== s.workspace.id)
      throw new DomainError("Workspace mismatch.");
    if (cmd.profile.confirmed) {
      if (!cmd.profile.description.trim() || !cmd.profile.goal.trim())
        throw new DomainError("Add a business description and goal.");
      if (!/^(https:\/\/[^\s]+|mailto:[^\s@]+@[^\s@]+)$/.test(cmd.profile.cta))
        throw new DomainError("Choose an HTTPS or email CTA.");
      if (
        cmd.profile.approvedClaims.some(
          (c) =>
            !s.knowledgeSources.some(
              (k) =>
                k.id === c.sourceId &&
                k.status === "ready" &&
                k.content.includes(c.text),
            ),
        )
      )
        throw new DomainError(
          "Approved claims must match their supporting source.",
        );
    }
    s.businessProfiles = [cmd.profile];
    audit(
      s,
      "Business brief updated",
      "Confirmed business context and writing guidance saved.",
      now,
      actor.id,
      undefined,
      undefined,
      "policy",
    );
  } else if (cmd.type === "brand") {
    if (cmd.brand.workspaceId !== s.workspace.id)
      throw new DomainError("Workspace mismatch.");
    s.brandProfiles.push({
      ...cmd.brand,
      id: `brand-${s.brandProfiles.length + 1}`,
      version: s.brandProfiles.length + 1,
    });
    audit(
      s,
      "Brand profile versioned",
      "New pages will use the updated brand. Published revisions stay unchanged.",
      now,
      actor.id,
    );
  } else if (cmd.type === "signal") {
    if (cmd.signal.workspaceId !== s.workspace.id)
      throw new DomainError("Workspace mismatch.");
    s.signalDefinitions = s.signalDefinitions.filter(
      (x) => x.id !== cmd.signal.id,
    );
    s.signalDefinitions.push(cmd.signal);
    audit(
      s,
      "Signal definition updated",
      `${cmd.signal.eventName} → ${cmd.signal.label}`,
      now,
      actor.id,
    );
  } else if (cmd.type === "knowledge") {
    if (cmd.source.workspaceId !== s.workspace.id)
      throw new DomainError("Workspace mismatch.");
    if (cmd.source.content.length > 200000)
      throw new DomainError("Source is too large.");
    s.knowledgeSources.push(cmd.source);
    for (let i = 0; i < cmd.source.content.length; i += 1200)
      s.knowledgeChunks.push({
        id: `chunk-${cmd.source.id}-${i}`,
        workspaceId: s.workspace.id,
        sourceId: cmd.source.id,
        text: cmd.source.content.slice(i, i + 1400),
        index: i / 1200,
      });
    audit(s, "Knowledge source added", cmd.source.title, now, actor.id);
  } else if (cmd.type === "propose_policy") {
    if (cmd.proposal.workspaceId !== s.workspace.id)
      throw new DomainError("Workspace mismatch.");
    s.policyProposals.push(cmd.proposal);
    audit(s, "Policy change proposed", cmd.proposal.title, now, actor.id);
  } else if (cmd.type === "resolve_policy") {
    const proposal = scoped(s, s.policyProposals, cmd.proposalId);
    if (proposal.status !== "pending")
      throw new DomainError("This proposal was already resolved.");
    proposal.status = cmd.approve ? "approved" : "rejected";
    if (cmd.approve) {
      const p = currentPolicy(s);
      s.policies.push({
        ...p,
        ...proposal.changes,
        id: `policy-${p.version + 1}`,
        version: p.version + 1,
        createdAt: now,
        actor: actor.id,
      });
    }
    audit(
      s,
      `Policy proposal ${proposal.status}`,
      proposal.title,
      now,
      actor.id,
      undefined,
      undefined,
      "policy",
    );
  } else if (cmd.type === "disconnect") {
    const c = scoped(s, s.connections, cmd.connectionId);
    c.status = "disconnected";
    delete c.fingerprint;
    for (const a of s.actions.filter(
      (a) => providerFor(a.kind) === c.provider && activeStatuses.has(a.status),
    )) {
      a.status = "cancelled";
      a.cancellationReason = "Provider disconnected.";
      audit(
        s,
        "Action cancelled",
        "The provider was disconnected.",
        now,
        actor.id,
        a.accountId,
        a.id,
      );
    }
    audit(
      s,
      "Provider disconnected",
      `${c.name}: Eve can no longer use this connection.`,
      now,
      actor.id,
    );
  } else if (cmd.type === "activate") {
    if (cmd.active && !s.businessProfiles[0]?.confirmed)
      throw new DomainError("Confirm the business brief first.");
    if (cmd.active && !s.signalDefinitions.some((x) => x.confirmed))
      throw new DomainError("Confirm at least one signal first.");
    s.workspace.active = cmd.active;
    audit(
      s,
      cmd.active ? "Eve activated" : "Eve deactivated",
      "Workspace processing status updated.",
      now,
      actor.id,
    );
  }
  if (["business", "brand", "signal"].includes(cmd.type)) {
    const p = currentPolicy(s);
    s.policies.push({
      ...p,
      id: `policy-${p.version + 1}`,
      version: p.version + 1,
      createdAt: now,
      actor: actor.id,
    });
  }
  if (
    ["authority", "business", "brand", "signal", "resolve_policy"].includes(
      cmd.type,
    )
  ) {
    for (const a of s.actions.filter((a) => activeStatuses.has(a.status))) {
      a.status =
        (currentPolicy(s).overrides[a.kind] ?? currentPolicy(s).mode) ===
        "observe"
          ? "draft"
          : "pending_approval";
      delete a.approvedBy;
      delete a.approvedAt;
      for (const approval of s.approvals.filter(
        (p) => p.actionId === a.id && p.status === "pending",
      )) {
        approval.status = "expired";
        approval.resolvedAt = now;
      }
      refreshStatus(s, a.accountId);
    }
  }
  return assertDataset(s);
}
export function claimAction(
  input: Dataset,
  actionId: string,
  now: number,
): { state: Dataset; claimed: boolean } {
  const s = structuredClone(input),
    a = scoped(s, s.actions, actionId);
  if (a.status !== "scheduled") return { state: input, claimed: false };
  const check = preflight(s, a, now);
  if (!check.allowed) {
    a.error = check.reason;
    if (check.disposition === "cancel") {
      a.status = "cancelled";
      a.cancellationReason = check.reason;
    } else if (check.disposition === "expire") a.status = "expired";
    else if (check.disposition === "reapprove") {
      a.status = "pending_approval";
      delete a.approvedBy;
      delete a.approvedAt;
    }
    if (input.actions.find((x) => x.id === a.id)?.error !== check.reason)
      audit(
        s,
        "Preflight blocked execution",
        check.reason!,
        now,
        "eve-system",
        a.accountId,
        a.id,
        "preflight",
      );
    refreshStatus(s, a.accountId);
    return { state: s, claimed: false };
  }
  a.status = "executing";
  a.attempts += 1;
  a.executedAt = now;
  delete a.error;
  audit(
    s,
    "Action execution claimed",
    `Idempotency lock acquired for ${a.kind}.`,
    now,
    "eve-system",
    a.accountId,
    a.id,
    "executing",
  );
  refreshStatus(s, a.accountId);
  return { state: s, claimed: true };
}
export function finishAction(
  input: Dataset,
  actionId: string,
  result: { providerId: string; error?: string },
  now: number,
): Dataset {
  const s = structuredClone(input),
    a = scoped(s, s.actions, actionId);
  if (a.status !== "executing") return input;
  if (result.error) {
    a.status = "failed";
    a.error = result.error;
    a.retrySafe = false;
    const crmChange = s.crmChanges.find((c) => c.actionId === a.id);
    if (crmChange) crmChange.status = "failed";
    audit(
      s,
      "Action needs reconciliation",
      result.error,
      now,
      "eve-system",
      a.accountId,
      a.id,
      "failed",
    );
    refreshStatus(s, a.accountId);
    return s;
  }
  if (a.kind === "page") {
    const check = preflight(s, a, now);
    if (!check.allowed) {
      a.status = "cancelled";
      a.cancellationReason = check.reason;
      audit(
        s,
        "Publication stopped",
        check.reason ?? "State changed before publication.",
        now,
        "eve-system",
        a.accountId,
        a.id,
      );
      return assertDataset(s);
    }
  }
  a.status = "succeeded";
  a.providerId = result.providerId;
  a.executedAt = now;
  const artifact = scoped(s, s.artifacts, a.artifactId),
    account = scoped(s, s.accounts, a.accountId);
  if (a.kind === "email" || a.kind === "call") {
    account.lastOutboundAt = now;
    s.conversations.push({
      id: `conversation-${a.id}`,
      workspaceId: s.workspace.id,
      accountId: a.accountId,
      channel: a.kind,
      direction: "outbound",
      text: artifact.body,
      subject: artifact.title,
      providerId: result.providerId,
      createdAt: now,
    });
    if (!a.followUp) {
      const follow = propose(
        s,
        account,
        "email",
        `Check in with ${account.name}`,
        `Hi ${s.contacts.find((c) => c.id === a.contactId)?.name.split(" ")[0] ?? "there"},\n\nIf setup is still blocked, reply with the step that needs a hand. The quickstart is here: ${s.businessProfiles[0].cta}\n\nThe ${s.businessProfiles[0].name} team`,
        "Offer practical help if the original setup blocker remains unresolved.",
        now,
        `followup-${a.id}`,
      );
      follow.followUp = true;
      follow.parentActionId = a.id;
      follow.scheduledAt = now + 86400000;
      follow.expiresAt = now + 7 * 86400000;
      if (
        (account.lastReplyAt && account.lastReplyAt >= a.createdAt) ||
        ["activated", "qualified", "customer"].includes(account.stage) ||
        account.suppressed
      )
        cancelStale(
          s,
          account.id,
          "Account changed while the first action was executing.",
          now,
        );
    }
  } else if (a.kind === "page") {
    const page = s.pageSpecs.find((p) => p.artifactId === a.artifactId);
    if (page) {
      page.status = "published";
      page.publishedAt = now;
    }
  } else if (a.kind === "crm") {
    const change = s.crmChanges.find((c) => c.actionId === a.id);
    if (change) {
      change.status = "synced";
      change.providerId = result.providerId;
    }
    account.crmId = result.providerId;
  }
  const provider = providerFor(a.kind),
    connection = s.connections.find((c) => c.provider === provider);
  if (connection) connection.lastSuccessAt = now;
  audit(
    s,
    a.kind === "email"
      ? "Email sent"
      : a.kind === "page"
        ? "Page published"
        : a.kind === "crm"
          ? "CRM updated"
          : "Call started",
    `${a.title}. Provider reference: ${result.providerId}`,
    now,
    "eve-system",
    a.accountId,
    a.id,
    "succeeded",
  );
  refreshStatus(s, a.accountId);
  return assertDataset(s);
}
export function retrieveKnowledge(s: Dataset, query: string) {
  const words = query
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2);
  return s.knowledgeChunks
    .map((c) => ({
      ...c,
      score: words.reduce(
        (n, w) => n + (c.text.toLowerCase().includes(w) ? 1 : 0),
        0,
      ),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

/** One revision is one immutable artifact, specification, and approval. */
export function savePageRevision(
  input: Dataset,
  accountId: string,
  spec: unknown,
  now: number,
): Dataset {
  const s = structuredClone(input),
    account = scoped(s, s.accounts, accountId);
  const errors = validatePage(s, spec);
  if (errors.length) throw new DomainError(errors.join(" "));
  const previous = s.pageSpecs
    .filter((p) => p.accountId === accountId)
    .sort((a, b) => b.revision - a.revision)[0];
  const revision = (previous?.revision ?? 0) + 1;
  const action = propose(
    s,
    account,
    "page",
    `Personalized page for ${account.name}`,
    `Page revision ${revision}, composed from approved sources.`,
    "A reviewed page revision can replace the current published experience.",
    now,
    `page-revision-${revision}`,
  );
  s.pageSpecs.push({
    id: `page-${accountId}-${revision}`,
    workspaceId: s.workspace.id,
    accountId,
    artifactId: action.artifactId,
    slug: previous?.slug ?? `${s.workspace.id}-${accountId}`,
    revision,
    brandVersion: s.brandProfiles.at(-1)!.version,
    policyVersion: currentPolicy(s).version,
    status: "validated",
    spec: pageSpecSchema.parse(spec),
    createdAt: now,
  });
  return assertDataset(s);
}
