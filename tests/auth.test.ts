import { it, expect, vi, afterEach } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import schema from "../convex/schema";
import authSchema from "../convex/betterAuth/schema";
import { components } from "../convex/_generated/api";
import { createWorkspace } from "../src/domain/initial-state";
import { saveState } from "../convex/repository";
const modules = import.meta.glob("../convex/**/*.ts");
const authModules = import.meta.glob("../convex/betterAuth/**/*.ts");
const authorize = makeFunctionReference<"query">("workspace:authorize");
const snapshot = makeFunctionReference<"query">("workspace:snapshot");
afterEach(() => vi.unstubAllEnvs());
it("authenticates a real component session and enforces membership and role", async () => {
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "test-only-secret-that-is-long-enough-for-auth",
  );
  const t = convexTest(schema, modules);
  t.registerComponent("betterAuth", authSchema, authModules);
  const now = Date.now();
  const create = async (model: string, data: Record<string, unknown>) =>
    t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: { model, data },
      } as never),
    );
  const user = await create("user", {
    name: "Viewer",
    email: "viewer@company.test",
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  const session = await create("session", {
    token: "test-session-token",
    userId: user._id,
    expiresAt: now + 3600000,
    createdAt: now,
    updatedAt: now,
  });
  await create("member", {
    userId: user._id,
    organizationId: "org-a",
    role: "viewer",
    createdAt: now,
  });
  await t.run(async (ctx) => {
    await saveState(
      ctx.db,
      createWorkspace(
        "tenant-a",
        "A",
        { id: user._id, name: "Viewer", email: "viewer@company.test" },
        now,
        "org-a",
      ),
    );
    await saveState(
      ctx.db,
      createWorkspace(
        "tenant-b",
        "B",
        { id: "other", name: "Other", email: "other@company.test" },
        now,
        "org-b",
      ),
    );
  });
  const viewer = t.withIdentity({ subject: user._id, sessionId: session._id });
  expect(
    await viewer.query(authorize, { workspaceId: "tenant-a" }),
  ).toMatchObject({ role: "viewer" });
  await expect(
    viewer.query(authorize, { workspaceId: "tenant-b" }),
  ).rejects.toThrow("Workspace unavailable");
  await expect(
    viewer.query(authorize, { workspaceId: "tenant-a", admin: true }),
  ).rejects.toThrow("permission");
  await expect(t.query(authorize, { workspaceId: "tenant-a" })).rejects.toThrow(
    "Unauthenticated",
  );
  const view = await viewer.query(snapshot, {});
  expect(view.data.workspace.id).toBe("tenant-a");
  expect(JSON.stringify(view)).not.toContain("test-session-token");
});
