import { v } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { internal, components } from "./_generated/api";
import { authComponent, createAuth } from "./auth";
import { loadState, saveState, requireMember } from "./repository";
import {
  applyCommand,
  ingest,
  claimAction,
  finishAction,
  recordOutcome,
  audit,
  DomainError,
  proposeActivation,
  currentPolicy,
  assertDataset,
  validatePage,
} from "../src/domain/engine";
import { createWorkspace } from "../src/domain/initial-state";
import {
  commandSchema,
  eventSchema,
  connectionSchema,
  datasetSchema,
  providerSchema,
  type Dataset,
} from "../src/domain/schema";
import { zodToConvex } from "convex-helpers/server/zod4";
export const snapshot = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const memberships = await ctx.runQuery(
      components.betterAuth.access.memberships,
      { userId: user._id },
    );
    for (const member of memberships) {
      const workspace = await ctx.db
        .query("workspaces")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", member.organizationId),
        )
        .unique();
      if (workspace) {
        const { role } = await requireMember(ctx, workspace.id);
        return { data: await loadState(ctx.db, workspace.id), role };
      }
    }
    return null;
  },
});
export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!name.trim() || name.length > 100)
      throw new DomainError("Enter a company name of up to 100 characters.");
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    const now = Date.now();
    const org = await auth.api.createOrganization({
      body: {
        name: name.trim(),
        slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${now}`,
      },
      headers,
    });
    if (!org) throw new DomainError("Organization could not be created.");
    const state = createWorkspace(
      `workspace-${org.id}`,
      name,
      { id: user._id, name: user.name, email: user.email },
      now,
      org.id,
    );
    state.workspace.pageBaseUrl = `${process.env.SITE_URL}/p`;
    audit(
      state,
      "Workspace created",
      "Brief Eve, confirm signals, connect your tools, and rehearse before activation.",
      now,
      user.name,
    );
    await saveState(ctx.db, state);
    return state.workspace.id;
  },
});
export const command = mutation({
  args: { workspaceId: v.string(), command: zodToConvex(commandSchema) },
  handler: async (ctx, args) => {
    const { user, role } = await requireMember(ctx, args.workspaceId);
    const before = await loadState(ctx.db, args.workspaceId);
    const next = applyCommand(
      before,
      args.command,
      { id: user._id, role },
      Date.now(),
    );
    if (args.command.type === "disconnect") {
      const connectionId = args.command.connectionId;
      const connection = before.connections.find((c) => c.id === connectionId)!;
      const credential = await ctx.db
        .query("credentials")
        .withIndex("by_workspace_provider", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("provider", connection.provider),
        )
        .unique();
      if (credential) await ctx.db.delete(credential._id);
      const webhook = await ctx.db
        .query("webhookSecrets")
        .withIndex("by_workspace_provider", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("provider", connection.provider),
        )
        .unique();
      if (webhook) await ctx.db.delete(webhook._id);
      if (connection.provider === "events") {
        const keys = await ctx.db
          .query("ingestionKeys")
          .withIndex("by_workspace", (q) =>
            q.eq("workspaceId", args.workspaceId),
          )
          .collect();
        for (const k of keys) await ctx.db.delete(k._id);
      }
    }
    await saveState(ctx.db, next);
    await ctx.scheduler.runAfter(0, internal.runtime.tick, {
      workspaceId: args.workspaceId,
    });
    return null;
  },
});
export const authorize = query({
  args: { workspaceId: v.string(), admin: v.optional(v.boolean()) },
  handler: async (ctx, { workspaceId, admin }) => {
    const { user, role } = await requireMember(
      ctx,
      workspaceId,
      admin ? ["owner", "admin"] : undefined,
    );
    return { userId: user._id, name: user.name, role };
  },
});
export const internalState = internalQuery({
  args: { workspaceId: v.string() },
  handler: (ctx, { workspaceId }) => loadState(ctx.db, workspaceId),
});
export const credential = internalQuery({
  args: { workspaceId: v.string(), provider: v.string() },
  handler: async (ctx, { workspaceId, provider }) =>
    ctx.db
      .query("credentials")
      .withIndex("by_workspace_provider", (q) =>
        q.eq("workspaceId", workspaceId).eq("provider", provider),
      )
      .unique(),
});
export const setConnection = internalMutation({
  args: {
    workspaceId: v.string(),
    connection: zodToConvex(connectionSchema),
    ciphertext: v.optional(v.string()),
    fingerprint: v.optional(v.string()),
    ingestHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (
      args.connection.workspaceId !== args.workspaceId ||
      args.connection.scope === "simulated"
    )
      throw new DomainError("Invalid live connection scope.");
    const state = await loadState(ctx.db, args.workspaceId);
    const idx = state.connections.findIndex(
      (c) => c.provider === args.connection.provider,
    );
    if (idx < 0) throw new DomainError("Unsupported provider.");
    const previousConnection = state.connections[idx];
    const authorizationChanged =
      !!args.ciphertext ||
      previousConnection.scope !== args.connection.scope ||
      previousConnection.providerAccountId !==
        args.connection.providerAccountId ||
      previousConnection.resourceId !== args.connection.resourceId ||
      JSON.stringify(previousConnection.mapping) !==
        JSON.stringify(args.connection.mapping);
    state.connections[idx] = args.connection;
    if (
      args.connection.provider === "context" &&
      args.connection.scope === "deployment"
    ) {
      if (args.ciphertext)
        throw new DomainError(
          "Deployment credentials must remain in server environment settings.",
        );
      const existing = await ctx.db
        .query("credentials")
        .withIndex("by_workspace_provider", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("provider", "context"),
        )
        .unique();
      if (existing) await ctx.db.delete(existing._id);
    } else if (args.ciphertext) {
      const existing = await ctx.db
        .query("credentials")
        .withIndex("by_workspace_provider", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("provider", args.connection.provider),
        )
        .unique();
      const value = {
        workspaceId: args.workspaceId,
        provider: args.connection.provider,
        ciphertext: args.ciphertext,
        keyVersion: 1,
        fingerprint: args.fingerprint ?? "",
        resourceId: args.connection.resourceId ?? "",
        createdAt: Date.now(),
      };
      if (existing) await ctx.db.replace(existing._id, value);
      else await ctx.db.insert("credentials", value);
    }
    if (args.ingestHash) {
      const keys = await ctx.db
        .query("ingestionKeys")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect();
      for (const k of keys) await ctx.db.delete(k._id);
      await ctx.db.insert("ingestionKeys", {
        workspaceId: args.workspaceId,
        hash: args.ingestHash,
        createdAt: Date.now(),
      });
    }
    audit(
      state,
      "Connection updated",
      `${args.connection.name}: ${args.connection.status}. Selected resources belong to ${args.connection.owner}.`,
      Date.now(),
      args.connection.owner,
      undefined,
      undefined,
      "connection",
    );
    const next = authorizationChanged
      ? applyCommand(
          state,
          { type: "authority", mode: currentPolicy(state).mode },
          { id: args.connection.owner, role: "admin" },
          Date.now(),
        )
      : state;
    await saveState(ctx.db, next);
  },
});
export const authenticateIngestion = internalQuery({
  args: { hash: v.string() },
  handler: async (ctx, { hash }) => {
    const key = await ctx.db
      .query("ingestionKeys")
      .withIndex("by_hash", (q) => q.eq("hash", hash))
      .unique();
    return key?.workspaceId ?? null;
  },
});
export const ingestEvent = internalMutation({
  args: { workspaceId: v.string(), event: zodToConvex(eventSchema) },
  handler: async (ctx, { workspaceId, event }) => {
    const now = Date.now(),
      window = Math.floor(now / 60000);
    const rate = await ctx.db
      .query("rateLimits")
      .withIndex("by_workspace_window", (q) =>
        q.eq("workspaceId", workspaceId).eq("window", window),
      )
      .unique();
    if (rate && rate.count >= 120)
      throw new DomainError(
        "Workspace ingestion rate limit reached.",
        "RATE_LIMIT",
      );
    if (rate) await ctx.db.patch(rate._id, { count: rate.count + 1 });
    else await ctx.db.insert("rateLimits", { workspaceId, window, count: 1 });
    const result = ingest(await loadState(ctx.db, workspaceId), event, now);
    await saveState(ctx.db, result.state);
    if (!result.duplicate) {
      await ctx.scheduler.runAfter(0, internal.runtime.tick, { workspaceId });
      if (result.accountId)
        await ctx.scheduler.runAfter(0, internal.providers.enrichAccount, {
          workspaceId,
          accountId: result.accountId,
        });
    }
    return {
      accepted: true,
      duplicate: result.duplicate,
      accountId: result.accountId ?? null,
    };
  },
});
export const claim = internalMutation({
  args: { workspaceId: v.string(), actionId: v.string() },
  handler: async (ctx, { workspaceId, actionId }) => {
    const result = claimAction(
      await loadState(ctx.db, workspaceId),
      actionId,
      Date.now(),
    );
    await saveState(ctx.db, result.state);
    return result.claimed;
  },
});
export const finish = internalMutation({
  args: {
    workspaceId: v.string(),
    actionId: v.string(),
    providerId: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const next = finishAction(
      await loadState(ctx.db, args.workspaceId),
      args.actionId,
      args,
      Date.now(),
    );
    await saveState(ctx.db, next);
  },
});
export const receiveOutcome = internalMutation({
  args: {
    workspaceId: v.string(),
    provider: v.string(),
    eventId: v.string(),
    accountId: v.string(),
    type: v.union(
      v.literal("reply"),
      v.literal("booking"),
      v.literal("unsubscribe"),
    ),
    text: v.string(),
  },
  handler: async (ctx, a) => {
    const prior = await ctx.db
      .query("webhookReceipts")
      .withIndex("by_event", (q) =>
        q
          .eq("workspaceId", a.workspaceId)
          .eq("provider", a.provider)
          .eq("eventId", a.eventId),
      )
      .unique();
    if (prior) return { duplicate: true };
    const state = await loadState(ctx.db, a.workspaceId);
    if (
      !state.connections.some(
        (c) => c.provider === a.provider && c.status === "healthy",
      )
    )
      throw new DomainError("Webhook provider is disconnected.");
    const next = recordOutcome(
      state,
      a.accountId,
      a.type,
      a.text,
      a.eventId,
      Date.now(),
      a.provider === "retell" ? "call" : "email",
    );
    await saveState(ctx.db, next);
    await ctx.db.insert("webhookReceipts", {
      workspaceId: a.workspaceId,
      provider: a.provider,
      eventId: a.eventId,
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.runtime.tick, {
      workspaceId: a.workspaceId,
    });
    return { duplicate: false };
  },
});
export const writeResearch = internalMutation({
  args: { workspaceId: v.string(), profile: v.any(), source: v.any() },
  handler: async (ctx, { workspaceId, profile, source }) => {
    let s = await loadState(ctx.db, workspaceId);
    s = applyCommand(
      s,
      { type: "knowledge", source },
      { id: "eve-system", role: "admin" },
      Date.now(),
    );
    s = applyCommand(
      s,
      { type: "business", profile },
      { id: "eve-system", role: "admin" },
      Date.now(),
    );
    await saveState(ctx.db, s);
  },
});
export const saveEnrichment = internalMutation({
  args: {
    workspaceId: v.string(),
    accountId: v.string(),
    description: v.string(),
    name: v.string(),
    industry: v.string(),
    employees: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const s = await loadState(ctx.db, args.workspaceId),
      a = s.accounts.find((a) => a.id === args.accountId);
    if (!a) throw new DomainError("Account unavailable.");
    a.summary = args.description;
    a.name = args.name;
    a.industry = args.industry;
    if (args.employees !== undefined) {
      a.employees = args.employees;
      a.fit =
        args.employees >= currentPolicy(s).minEmployees ? "high" : "medium";
    }
    const exclusions = s.businessProfiles[0].exclusions;
    if (
      exclusions.some((x) => /agenc|consultanc/i.test(x)) &&
      /agenc|consultanc/i.test(a.industry)
    ) {
      a.fit = "excluded";
      a.suppressed = true;
    }
    s.memories.push({
      id: `enrichment-${Date.now()}`,
      workspaceId: args.workspaceId,
      accountId: a.id,
      text: args.description,
      source: `Context.dev · https://${a.domain}`,
      confidence: 0.8,
      kind: "observed",
      createdAt: Date.now(),
    });
    audit(
      s,
      "Company context enriched",
      "Context.dev company information was stored with its source. It does not grant authority.",
      Date.now(),
      "eve-system",
      a.id,
    );
    await saveState(ctx.db, s);
  },
});
export const saveGeneratedPage = internalMutation({
  args: {
    workspaceId: v.string(),
    accountId: v.string(),
    spec: v.any(),
    expectedPolicy: v.number(),
  },
  handler: async (ctx, args) => {
    const s = await loadState(ctx.db, args.workspaceId);
    if (currentPolicy(s).version !== args.expectedPolicy)
      throw new DomainError(
        "Policy changed during generation. Please generate again.",
      );
    const { savePageRevision } = await import("../src/domain/engine");
    const next = savePageRevision(s, args.accountId, args.spec, Date.now());
    await saveState(ctx.db, next);
    await ctx.scheduler.runAfter(0, internal.runtime.tick, {
      workspaceId: args.workspaceId,
    });
  },
});
export const rehearse = mutation({
  args: { workspaceId: v.string() },
  handler: async (ctx, { workspaceId }) => {
    const { user } = await requireMember(ctx, workspaceId, [
      "owner",
      "admin",
      "operator",
    ]);
    const s = await loadState(ctx.db, workspaceId);
    const now = Date.now(),
      event = {
        eventId: `test-prospect-${now}`,
        workspaceId,
        eventName: "user_signed_up",
        occurredAt: now,
        userId: "eve-test-prospect",
        userEmail: "sarah@eve-test.example",
        companyDomain: "eve-test.example",
        productWorkspaceId: "eve-test",
        properties: { name: "Sarah · test prospect" },
      };
    const result = ingest(s, event, now);
    if (result.accountId) {
      const account = result.state.accounts.find(
        (a) => a.id === result.accountId,
      )!;
      account.paused = true;
      account.status = "paused";
      proposeActivation(result.state, account, now);
      for (const a of result.state.actions.filter(
        (a) => a.accountId === account.id,
      ))
        a.status = "draft";
      audit(
        result.state,
        "Test prospect received",
        "Rehearsal account is paused. All actions remain drafts and cannot execute.",
        now,
        user.name,
        account.id,
      );
    }
    await saveState(ctx.db, result.state);
    return result.accountId;
  },
});
export const publicPage = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const rows = await ctx.db
      .query("pageSpecs")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .filter((q) => q.eq(q.field("status"), "published"))
      .collect();
    const page = rows.sort((a, b) => b.revision - a.revision)[0];
    if (!page) return null;
    const brands = await ctx.db
      .query("brandProfiles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", page.workspaceId))
      .collect();
    const brand = brands.find((b) => b.version === page.brandVersion);
    return {
      spec: page.spec,
      brand: brand
        ? {
            primary: brand.primary,
            background: brand.background,
            font: brand.font,
            radius: brand.radius,
          }
        : null,
    };
  },
});
export const activeWorkspaces = internalQuery({
  args: {},
  handler: async (ctx) =>
    (await ctx.db.query("workspaces").collect())
      .filter((w) => w.active && !w.paused)
      .map((w) => w.id),
});
export const connectionError = internalMutation({
  args: { workspaceId: v.string(), provider: v.string(), message: v.string() },
  handler: async (ctx, { workspaceId, provider, message }) => {
    const s = await loadState(ctx.db, workspaceId),
      c = s.connections.find((c) => c.provider === provider);
    if (c) c.lastError = message;
    audit(
      s,
      "Provider operation needs attention",
      message,
      Date.now(),
      "eve-system",
      undefined,
      undefined,
      "connection",
    );
    await saveState(ctx.db, s);
  },
});
export const recheckClaim = internalMutation({
  args: { workspaceId: v.string(), actionId: v.string() },
  handler: async (ctx, { workspaceId, actionId }) => {
    const s = await loadState(ctx.db, workspaceId),
      a = s.actions.find((a) => a.id === actionId);
    if (!a || a.status !== "executing") return false;
    const { preflight } = await import("../src/domain/engine");
    const check = preflight(s, a, Date.now());
    if (!check.allowed) {
      a.status = "cancelled";
      a.cancellationReason = check.reason;
      audit(
        s,
        "Dispatch stopped",
        check.reason ?? "Preflight changed.",
        Date.now(),
        "eve-system",
        a.accountId,
        a.id,
      );
      await saveState(ctx.db, s);
      return false;
    }
    return true;
  },
});
export const expireInterrupted = internalMutation({
  args: {},
  handler: async (ctx) => {
    const workspaces = await ctx.db.query("workspaces").collect();
    for (const workspace of workspaces) {
      const state = await loadState(ctx.db, workspace.id);
      let changed = false;
      for (const a of state.actions) {
        if (
          a.status === "executing" &&
          (a.executedAt ?? a.createdAt) < Date.now() - 10 * 60000
        ) {
          a.status = "failed";
          a.error =
            "Execution was interrupted. Reconcile the provider result before any manual retry.";
          a.retrySafe = false;
          audit(
            state,
            "Interrupted action requires reconciliation",
            a.error,
            Date.now(),
            "eve-system",
            a.accountId,
            a.id,
          );
          changed = true;
        } else if (
          ["draft", "pending_approval", "scheduled", "approved"].includes(
            a.status,
          ) &&
          a.expiresAt < Date.now()
        ) {
          a.status = "expired";
          audit(
            state,
            "Action expired",
            "The action’s approval window has ended.",
            Date.now(),
            "eve-system",
            a.accountId,
            a.id,
          );
          changed = true;
        }
      }
      if (changed) await saveState(ctx.db, state);
    }
    const stale = await ctx.db
      .query("rateLimits")
      .filter((q) =>
        q.lt(q.field("window"), Math.floor(Date.now() / 60000) - 60),
      )
      .take(1000);
    for (const item of stale) await ctx.db.delete(item._id);
  },
});

export const stopCustomer = internalMutation({
  args: { workspaceId: v.string(), accountId: v.string() },
  handler: async (ctx, { workspaceId, accountId }) => {
    const s = await loadState(ctx.db, workspaceId);
    const next = applyCommand(
      s,
      { type: "customer", accountId },
      { id: "CRM preflight", role: "operator" },
      Date.now(),
    );
    await saveState(ctx.db, next);
  },
});
