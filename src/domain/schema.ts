import { z } from "zod";

export const authoritySchema = z.enum(["observe", "copilot", "autopilot"]);
export const actionKindSchema = z.enum(["email", "page", "call", "crm"]);
export const actionStatusSchema = z.enum([
  "draft",
  "pending_approval",
  "approved",
  "scheduled",
  "executing",
  "succeeded",
  "failed",
  "rejected",
  "cancelled",
  "expired",
]);
export const roleSchema = z.enum(["owner", "admin", "operator", "viewer"]);
const base = { id: z.string(), workspaceId: z.string() };
export const workspaceSchema = z.object({
  ...base,
  name: z.string(),
  organizationId: z.string(),
  pageBaseUrl: z.string().optional(),
  timezone: z.string(),
  mode: authoritySchema,
  paused: z.boolean(),
  active: z.boolean(),
  createdAt: z.number(),
});
export const memberSchema = z.object({
  ...base,
  userId: z.string(),
  email: z.string(),
  name: z.string(),
  role: roleSchema,
});
export const sourceSchema = z.object({
  ...base,
  title: z.string(),
  kind: z.enum(["website", "file", "user", "inferred"]),
  content: z.string(),
  url: z.string().optional(),
  status: z.enum(["ready", "processing", "error"]),
  createdAt: z.number(),
});
export const businessSchema = z.object({
  ...base,
  name: z.string(),
  website: z.string(),
  description: z.string(),
  goal: z.string(),
  icp: z.string(),
  exclusions: z.array(z.string()),
  approvedClaims: z.array(z.object({ text: z.string(), sourceId: z.string() })),
  writingRules: z.array(z.string()),
  prohibitedPhrases: z.array(z.string()),
  offer: z.string(),
  cta: z.string(),
  confirmed: z.boolean(),
  pageStrategy: z.enum(["immediate", "qualified"]),
});
export const brandSchema = z.object({
  ...base,
  version: z.number(),
  name: z.string(),
  primary: z.string().regex(/^#[\da-fA-F]{6}$/),
  background: z.string().regex(/^#[\da-fA-F]{6}$/),
  font: z.enum(["geist", "serif"]),
  radius: z.enum(["none", "small", "round"]),
  confirmed: z.boolean(),
});
export const signalSchema = z.object({
  ...base,
  eventName: z.string(),
  label: z.string(),
  meaning: z.enum([
    "activation",
    "intent",
    "friction",
    "expansion",
    "disengagement",
    "signup",
  ]),
  description: z.string(),
  confirmed: z.boolean(),
});
export const accountSchema = z.object({
  ...base,
  name: z.string(),
  domain: z.string(),
  initials: z.string(),
  color: z.string(),
  industry: z.string(),
  employees: z.number().optional(),
  fit: z.enum(["high", "medium", "unknown", "excluded"]),
  observedIntent: z.string(),
  inferredIntent: z.string(),
  confidence: z.number().min(0).max(1),
  stage: z.enum([
    "new",
    "evaluating",
    "activated",
    "qualified",
    "customer",
    "closed",
  ]),
  status: z.enum([
    "needs_attention",
    "working",
    "scheduled",
    "monitoring",
    "paused",
  ]),
  owner: z.string(),
  paused: z.boolean(),
  suppressed: z.boolean(),
  lastSignalAt: z.number(),
  lastSignal: z.string(),
  summary: z.string(),
  contactId: z.string().optional(),
  crmId: z.string().optional(),
  lastOutboundAt: z.number().optional(),
  lastReplyAt: z.number().optional(),
});
export const contactSchema = z.object({
  ...base,
  accountId: z.string(),
  name: z.string(),
  email: z.string().email(),
  title: z.string(),
  userId: z.string(),
  suppressed: z.boolean(),
  phone: z.string().optional(),
  phoneConsent: z.boolean(),
});
export const productWorkspaceSchema = z.object({
  ...base,
  accountId: z.string(),
  externalId: z.string(),
  name: z.string(),
});
export const identitySchema = z.object({
  ...base,
  accountId: z.string(),
  contactId: z.string().optional(),
  kind: z.enum(["user", "email", "product_workspace", "domain"]),
  value: z.string(),
});
export const eventSchema = z.object({
  eventId: z.string().min(1).max(200),
  workspaceId: z.string().min(1),
  eventName: z.string().min(1).max(120),
  occurredAt: z.number().int().nonnegative(),
  userId: z.string().max(200).optional(),
  userEmail: z.string().email().optional(),
  accountId: z.string().optional(),
  anonymousId: z.string().optional(),
  productWorkspaceId: z.string().max(200).optional(),
  companyDomain: z.string().max(253).optional(),
  properties: z.record(
    z.string(),
    z.union([z.string().max(1000), z.number(), z.boolean(), z.null()]),
  ),
});
export const storedEventSchema = eventSchema.extend({
  id: z.string(),
  resolvedAccountId: z.string().optional(),
});
export const memorySchema = z.object({
  ...base,
  accountId: z.string(),
  text: z.string(),
  source: z.string(),
  confidence: z.number(),
  kind: z.enum(["observed", "inferred", "operator"]),
  createdAt: z.number(),
  expiresAt: z.number().optional(),
});
export const providerSchema = z.enum([
  "events",
  "agentmail",
  "retell",
  "context",
  "hubspot",
  "model",
]);
export const connectionSchema = z.object({
  ...base,
  provider: providerSchema,
  name: z.string(),
  description: z.string(),
  status: z.enum(["healthy", "disconnected", "error", "pending"]),
  owner: z.string(),
  scope: z.enum(["workspace", "deployment", "simulated"]),
  capabilities: z.array(z.string()),
  resourceId: z.string().optional(),
  providerAccountId: z.string().optional(),
  lastSuccessAt: z.number().optional(),
  lastError: z.string().optional(),
  fingerprint: z.string().optional(),
  mapping: z.record(z.string(), z.string()).optional(),
});
export const policySchema = z.object({
  ...base,
  version: z.number(),
  mode: authoritySchema,
  overrides: z.object({
    email: authoritySchema.optional(),
    page: authoritySchema.optional(),
    call: authoritySchema.optional(),
    crm: authoritySchema.optional(),
  }),
  pausedChannels: z.array(actionKindSchema),
  minEmployees: z.number().min(0).max(100000),
  requireIntent: z.boolean(),
  quietStart: z.number().min(0).max(23),
  quietEnd: z.number().min(0).max(23),
  maxContactPerDay: z.number().min(1).max(10),
  maxAccountPerDay: z.number().min(1).max(20),
  approvalTtlHours: z.number(),
  createdAt: z.number(),
  actor: z.string(),
});
export const artifactSchema = z.object({
  ...base,
  accountId: z.string(),
  kind: actionKindSchema,
  title: z.string(),
  body: z.string(),
  revision: z.number(),
  sourceIds: z.array(z.string()),
  reasonNow: z.string(),
  cta: z.string(),
  createdAt: z.number(),
});
export const actionSchema = z.object({
  ...base,
  accountId: z.string(),
  contactId: z.string().optional(),
  artifactId: z.string(),
  kind: actionKindSchema,
  title: z.string(),
  status: actionStatusSchema,
  rationale: z.string(),
  evidenceIds: z.array(z.string()),
  policyVersion: z.number(),
  createdAt: z.number(),
  scheduledAt: z.number().optional(),
  expiresAt: z.number(),
  approvedBy: z.string().optional(),
  approvedAt: z.number().optional(),
  providerId: z.string().optional(),
  idempotencyKey: z.string(),
  attempts: z.number(),
  error: z.string().optional(),
  cancellationReason: z.string().optional(),
  followUp: z.boolean(),
  parentActionId: z.string().optional(),
  executedAt: z.number().optional(),
  retrySafe: z.boolean(),
  requiredPageId: z.string().optional(),
});
export const approvalSchema = z.object({
  ...base,
  actionId: z.string(),
  status: z.enum(["pending", "approved", "rejected", "expired"]),
  actor: z.string().optional(),
  note: z.string().optional(),
  createdAt: z.number(),
  resolvedAt: z.number().optional(),
});
export const pagePropsSchema = z
  .object({
    title: z.string().max(200).optional(),
    text: z.string().max(3000).optional(),
    eyebrow: z.string().max(100).optional(),
    items: z.array(z.string().max(1000)).max(10).optional(),
    ctaLabel: z.string().max(100).optional(),
    ctaHref: z.string().max(2000).optional(),
    tone: z.enum(["light", "accent", "subtle"]).optional(),
    sourceIds: z.array(z.string()).optional(),
  })
  .strict();
export const pageElementSchema = z
  .object({
    type: z.enum([
      "Stack",
      "Hero",
      "ContextBanner",
      "Capabilities",
      "Steps",
      "Proof",
      "Offer",
      "FAQ",
      "CTA",
      "Footer",
    ]),
    props: pagePropsSchema,
    children: z.array(z.string()).optional(),
  })
  .strict();
export const pageSpecSchema = z
  .object({
    root: z.string(),
    elements: z.record(z.string(), pageElementSchema),
  })
  .strict();
export const pageSchema = z.object({
  ...base,
  accountId: z.string(),
  artifactId: z.string(),
  slug: z.string(),
  revision: z.number(),
  brandVersion: z.number(),
  policyVersion: z.number(),
  status: z.enum(["draft", "validated", "published", "unpublished"]),
  spec: pageSpecSchema,
  publishedAt: z.number().optional(),
  createdAt: z.number(),
});
export const conversationSchema = z.object({
  ...base,
  accountId: z.string(),
  channel: z.enum(["email", "call", "chat"]),
  direction: z.enum(["inbound", "outbound", "internal"]),
  text: z.string(),
  subject: z.string().optional(),
  providerId: z.string().optional(),
  createdAt: z.number(),
});
export const auditSchema = z.object({
  ...base,
  accountId: z.string().optional(),
  actionId: z.string().optional(),
  type: z.string(),
  title: z.string(),
  detail: z.string(),
  actor: z.string(),
  policyVersion: z.number(),
  createdAt: z.number(),
});
export const outcomeSchema = z.object({
  ...base,
  accountId: z.string(),
  type: z.enum([
    "activated",
    "reply",
    "booking",
    "upgrade",
    "opportunity",
    "unsubscribe",
  ]),
  label: z.string(),
  value: z.number().optional(),
  createdAt: z.number(),
});
export const runSchema = z.object({
  ...base,
  accountId: z.string(),
  status: z.enum(["running", "waiting", "completed", "failed"]),
  summary: z.string(),
  createdAt: z.number(),
});
export const policyProposalSchema = z.object({
  ...base,
  title: z.string(),
  changes: z.object({
    minEmployees: z.number().optional(),
    requireIntent: z.boolean().optional(),
    pausedChannels: z.array(actionKindSchema).optional(),
  }),
  before: z.string(),
  after: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  createdAt: z.number(),
});
export const crmChangeSchema = z.object({
  ...base,
  accountId: z.string(),
  actionId: z.string(),
  fields: z.record(z.string(), z.string()),
  status: z.enum(["proposed", "synced", "failed"]),
  providerId: z.string().optional(),
  createdAt: z.number(),
});
export const knowledgeChunkSchema = z.object({
  ...base,
  sourceId: z.string(),
  text: z.string(),
  index: z.number(),
});
export const entitySchemas = {
  workspaceMembers: memberSchema,
  businessProfiles: businessSchema,
  brandProfiles: brandSchema,
  knowledgeSources: sourceSchema,
  knowledgeChunks: knowledgeChunkSchema,
  signalDefinitions: signalSchema,
  accounts: accountSchema,
  contacts: contactSchema,
  productWorkspaces: productWorkspaceSchema,
  identities: identitySchema,
  productEvents: storedEventSchema,
  memories: memorySchema,
  connections: connectionSchema,
  policies: policySchema,
  agentRuns: runSchema,
  actions: actionSchema,
  approvals: approvalSchema,
  artifacts: artifactSchema,
  pageSpecs: pageSchema,
  conversations: conversationSchema,
  auditEntries: auditSchema,
  outcomes: outcomeSchema,
  policyProposals: policyProposalSchema,
  crmChanges: crmChangeSchema,
};
export const datasetSchema = z.object({
  workspace: workspaceSchema,
  workspaceMembers: z.array(memberSchema),
  businessProfiles: z.array(businessSchema),
  brandProfiles: z.array(brandSchema),
  knowledgeSources: z.array(sourceSchema),
  knowledgeChunks: z.array(knowledgeChunkSchema),
  signalDefinitions: z.array(signalSchema),
  accounts: z.array(accountSchema),
  contacts: z.array(contactSchema),
  productWorkspaces: z.array(productWorkspaceSchema),
  identities: z.array(identitySchema),
  productEvents: z.array(storedEventSchema),
  memories: z.array(memorySchema),
  connections: z.array(connectionSchema),
  policies: z.array(policySchema),
  agentRuns: z.array(runSchema),
  actions: z.array(actionSchema),
  approvals: z.array(approvalSchema),
  artifacts: z.array(artifactSchema),
  pageSpecs: z.array(pageSchema),
  conversations: z.array(conversationSchema),
  auditEntries: z.array(auditSchema),
  outcomes: z.array(outcomeSchema),
  policyProposals: z.array(policyProposalSchema),
  crmChanges: z.array(crmChangeSchema),
});
export type Dataset = z.infer<typeof datasetSchema>;
export type DemoDataset = Dataset;
export type Account = z.infer<typeof accountSchema>;
export type Action = z.infer<typeof actionSchema>;
export type Artifact = z.infer<typeof artifactSchema>;
export type ProductEvent = z.infer<typeof eventSchema>;
export type Policy = z.infer<typeof policySchema>;
export type PageSpec = z.infer<typeof pageSpecSchema>;
export type Role = z.infer<typeof roleSchema>;
export type Provider = z.infer<typeof providerSchema>;
export type Connection = z.infer<typeof connectionSchema>;

export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("pause"),
    accountId: z.string().optional(),
    paused: z.boolean(),
  }),
  z.object({
    type: z.literal("authority"),
    mode: authoritySchema,
    overrides: policySchema.shape.overrides.optional(),
  }),
  z.object({ type: z.literal("approve"), actionId: z.string() }),
  z.object({
    type: z.literal("reject"),
    actionId: z.string(),
    reason: z.string().min(1),
  }),
  z.object({
    type: z.literal("cancel"),
    actionId: z.string(),
    reason: z.string().min(1),
  }),
  z.object({
    type: z.literal("schedule"),
    actionId: z.string(),
    scheduledAt: z.number(),
  }),
  z.object({
    type: z.literal("edit"),
    actionId: z.string(),
    title: z.string().min(1),
    body: z.string().min(1),
  }),
  z.object({
    type: z.literal("memory"),
    accountId: z.string(),
    text: z.string().min(1).max(4000),
  }),
  z.object({
    type: z.literal("prepare_call"),
    accountId: z.string(),
    phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
    consent: z.literal(true),
    consentNote: z.string().min(8).max(1000),
  }),
  z.object({ type: z.literal("unpublish"), pageId: z.string() }),
  z.object({ type: z.literal("customer"), accountId: z.string() }),
  z.object({ type: z.literal("business"), profile: businessSchema }),
  z.object({ type: z.literal("brand"), brand: brandSchema }),
  z.object({ type: z.literal("signal"), signal: signalSchema }),
  z.object({ type: z.literal("knowledge"), source: sourceSchema }),
  z.object({
    type: z.literal("propose_policy"),
    proposal: policyProposalSchema,
  }),
  z.object({
    type: z.literal("resolve_policy"),
    proposalId: z.string(),
    approve: z.boolean(),
  }),
  z.object({ type: z.literal("disconnect"), connectionId: z.string() }),
  z.object({ type: z.literal("activate"), active: z.boolean() }),
]);
export type Command = z.infer<typeof commandSchema>;
