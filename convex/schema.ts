import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { zodToConvex } from "convex-helpers/server/zod4";
import { workspaceSchema, entitySchemas } from "../src/domain/schema";
export default defineSchema({
  workspaces: defineTable(zodToConvex(workspaceSchema))
    .index("by_external_id", ["id"])
    .index("by_organization", ["organizationId"]),
  workspaceMembers: defineTable(zodToConvex(entitySchemas.workspaceMembers))
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  businessProfiles: defineTable(zodToConvex(entitySchemas.businessProfiles))
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  brandProfiles: defineTable(zodToConvex(entitySchemas.brandProfiles))
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  knowledgeSources: defineTable(zodToConvex(entitySchemas.knowledgeSources))
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  knowledgeChunks: defineTable(zodToConvex(entitySchemas.knowledgeChunks))
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  signalDefinitions: defineTable(zodToConvex(entitySchemas.signalDefinitions))
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  accounts: defineTable(zodToConvex(entitySchemas.accounts))
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  contacts: defineTable(zodToConvex(entitySchemas.contacts))
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  productWorkspaces: defineTable(zodToConvex(entitySchemas.productWorkspaces))
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  identities: defineTable(zodToConvex(entitySchemas.identities))
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  productEvents: defineTable(zodToConvex(entitySchemas.productEvents))
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  memories: defineTable(zodToConvex(entitySchemas.memories))
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  connections: defineTable(zodToConvex(entitySchemas.connections))
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  policies: defineTable(zodToConvex(entitySchemas.policies))
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  agentRuns: defineTable(zodToConvex(entitySchemas.agentRuns))
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  actions: defineTable(zodToConvex(entitySchemas.actions))
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  approvals: defineTable(zodToConvex(entitySchemas.approvals))
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  artifacts: defineTable(zodToConvex(entitySchemas.artifacts))
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  pageSpecs: defineTable(zodToConvex(entitySchemas.pageSpecs))
    .index("by_slug", ["slug"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  conversations: defineTable(zodToConvex(entitySchemas.conversations))
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  auditEntries: defineTable(zodToConvex(entitySchemas.auditEntries))
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  outcomes: defineTable(zodToConvex(entitySchemas.outcomes))
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  policyProposals: defineTable(zodToConvex(entitySchemas.policyProposals))
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  crmChanges: defineTable(zodToConvex(entitySchemas.crmChanges))
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_id", ["workspaceId", "id"]),
  credentials: defineTable({
    workspaceId: v.string(),
    provider: v.string(),
    ciphertext: v.string(),
    keyVersion: v.number(),
    fingerprint: v.string(),
    resourceId: v.string(),
    createdAt: v.number(),
  }).index("by_workspace_provider", ["workspaceId", "provider"]),
  ingestionKeys: defineTable({
    workspaceId: v.string(),
    hash: v.string(),
    createdAt: v.number(),
  })
    .index("by_hash", ["hash"])
    .index("by_workspace", ["workspaceId"]),
  webhookReceipts: defineTable({
    workspaceId: v.string(),
    provider: v.string(),
    eventId: v.string(),
    createdAt: v.number(),
  }).index("by_event", ["workspaceId", "provider", "eventId"]),
  webhookSecrets: defineTable({
    workspaceId: v.string(),
    provider: v.string(),
    ciphertext: v.string(),
  }).index("by_workspace_provider", ["workspaceId", "provider"]),
  rateLimits: defineTable({
    workspaceId: v.string(),
    window: v.number(),
    count: v.number(),
  }).index("by_workspace_window", ["workspaceId", "window"]),
});
