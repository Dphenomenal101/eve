import type {
  GenericDatabaseReader,
  GenericDatabaseWriter,
  GenericDataModel,
} from "convex/server";
import {
  entitySchemas,
  datasetSchema,
  type Dataset,
  type Role,
} from "../src/domain/schema";
import { assertDataset, DomainError } from "../src/domain/engine";
import { authComponent } from "./auth";
import { components } from "./_generated/api";
import type { QueryCtx, MutationCtx } from "./_generated/server";
export async function requireMember(
  ctx: QueryCtx | MutationCtx,
  workspaceId: string,
  roles?: Role[],
) {
  const user = await authComponent.getAuthUser(ctx);
  const workspace = await ctx.db
    .query("workspaces")
    .withIndex("by_external_id", (q) => q.eq("id", workspaceId))
    .unique();
  if (!workspace) throw new DomainError("Workspace unavailable.", "FORBIDDEN");
  const memberships = await ctx.runQuery(
    components.betterAuth.access.memberships,
    { userId: user._id },
  );
  const member = memberships.find(
    (m) => m.organizationId === workspace.organizationId,
  );
  if (!member) throw new DomainError("Workspace unavailable.", "FORBIDDEN");
  const role: Role =
    member.role === "owner"
      ? "owner"
      : member.role === "admin"
        ? "admin"
        : member.role === "operator"
          ? "operator"
          : "viewer";
  if (roles && !roles.includes(role))
    throw new DomainError(
      "You do not have permission for this operation.",
      "FORBIDDEN",
    );
  return { user, role, workspace };
}
/** All access is indexed by tenant. This aggregate boundary deliberately validates the complete shared schema. */
export async function loadState(
  db: QueryCtx["db"],
  workspaceId: string,
): Promise<Dataset> {
  const workspace = await db
    .query("workspaces")
    .withIndex("by_external_id", (q) => q.eq("id", workspaceId))
    .unique();
  if (!workspace) throw new DomainError("Workspace unavailable.", "NOT_FOUND");
  const state: Record<string, unknown> = { workspace };
  for (const name of Object.keys(
    entitySchemas,
  ) as (keyof typeof entitySchemas)[])
    state[name] = await db
      .query(name)
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
  return datasetSchema.parse(state);
}
/** Writes deltas only; event, artifact revision, outcome, and audit records are immutable. Convex serializes concurrent mutations. */
export async function saveState(db: MutationCtx["db"], state: Dataset) {
  assertDataset(state);
  const workspace = await db
    .query("workspaces")
    .withIndex("by_external_id", (q) => q.eq("id", state.workspace.id))
    .unique();
  if (workspace) await db.replace(workspace._id, state.workspace);
  else await db.insert("workspaces", state.workspace);
  const immutable = new Set([
    "productEvents",
    "auditEntries",
    "artifacts",
    "policies",
    "outcomes",
    "knowledgeChunks",
  ]);
  for (const name of Object.keys(
    entitySchemas,
  ) as (keyof typeof entitySchemas)[]) {
    const previous = await db
      .query(name)
      .withIndex("by_workspace", (q) => q.eq("workspaceId", state.workspace.id))
      .collect();
    for (const row of state[name]) {
      const found = previous.find((p) => p.id === row.id);
      if (found) {
        const { _id, _creationTime, ...old } = found;
        if (name === "pageSpecs") {
          const previous = entitySchemas.pageSpecs.parse(old),
            next = entitySchemas.pageSpecs.parse(row);
          if (
            JSON.stringify(previous.spec) !== JSON.stringify(next.spec) ||
            previous.brandVersion !== next.brandVersion
          )
            throw new DomainError(
              "Page content is immutable. Create a new revision.",
            );
        }
        if (JSON.stringify(old) !== JSON.stringify(row)) {
          if (immutable.has(name)) {
            const parsed = entitySchemas[name].parse(old);
            if (JSON.stringify(parsed) !== JSON.stringify(row))
              throw new DomainError(
                `Immutable ${name} record cannot be changed.`,
              );
          } else await db.replace(_id, row as never);
        }
      } else await db.insert(name, row as never);
    }
  }
}
