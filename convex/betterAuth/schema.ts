import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { tables } from "./base-schema";
export default defineSchema({
  ...tables,
  session: defineTable({
    ...tables.session.validator.fields,
    activeOrganizationId: v.optional(v.union(v.string(), v.null())),
  })
    .index("token", ["token"])
    .index("userId", ["userId"])
    .index("expiresAt", ["expiresAt"]),
  organization: defineTable({
    name: v.string(),
    slug: v.string(),
    logo: v.optional(v.union(v.string(), v.null())),
    createdAt: v.number(),
    metadata: v.optional(v.union(v.string(), v.null())),
  }).index("slug", ["slug"]),
  member: defineTable({
    organizationId: v.string(),
    userId: v.string(),
    role: v.string(),
    createdAt: v.number(),
  })
    .index("organizationId", ["organizationId"])
    .index("userId", ["userId"])
    .index("organizationId_userId", ["organizationId", "userId"]),
  invitation: defineTable({
    organizationId: v.string(),
    email: v.string(),
    role: v.optional(v.union(v.string(), v.null())),
    status: v.string(),
    expiresAt: v.number(),
    inviterId: v.string(),
    createdAt: v.number(),
  })
    .index("organizationId", ["organizationId"])
    .index("email", ["email"]),
});
