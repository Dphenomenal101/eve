import { it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { loadState, saveState } from "../convex/repository";
import { createWorkspace } from "../src/domain/initial-state";
import { audit } from "../src/domain/engine";
const modules = import.meta.glob("../convex/**/*.ts");
it("isolates two tenant aggregates even when record ids overlap", async () => {
  const t = convexTest(schema, modules);
  const user = { id: "u", name: "Operator", email: "operator@company.test" };
  const a = createWorkspace("tenant-a", "A", user, 1000),
    b = createWorkspace("tenant-b", "B", user, 1000);
  await t.run(async (ctx) => {
    await saveState(ctx.db, a);
    await saveState(ctx.db, b);
  });
  await t.run(async (ctx) => {
    const first = await loadState(ctx.db, "tenant-a");
    expect(first.businessProfiles[0].name).toBe("A");
    expect(first.connections.every((c) => c.workspaceId === "tenant-a")).toBe(
      true,
    );
    const second = await loadState(ctx.db, "tenant-b");
    expect(second.businessProfiles[0].name).toBe("B");
  });
});
it("rejects rewriting an existing append-only audit record", async () => {
  const t = convexTest(schema, modules);
  const s = createWorkspace(
    "tenant-a",
    "A",
    { id: "u", name: "Operator", email: "operator@company.test" },
    1000,
  );
  audit(s, "Original", "Unchanged evidence", 1000);
  await t.run((ctx) => saveState(ctx.db, s));
  s.auditEntries[0].detail = "Forged history";
  await expect(t.run((ctx) => saveState(ctx.db, s))).rejects.toThrow(
    "Immutable",
  );
});
