import { afterEach, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import schema from "../convex/schema";
import authSchema from "../convex/betterAuth/schema";
import { components } from "../convex/_generated/api";
import { createWorkspace } from "../src/domain/initial-state";
import { saveState } from "../convex/repository";

const { retrieve } = vi.hoisted(() => ({ retrieve: vi.fn() }));
vi.mock("context.dev", () => ({
  default: class {
    brand;
    constructor(options: { apiKey: string }) {
      this.brand = {
        retrieve: (request: unknown) => retrieve(options.apiKey, request),
      };
    }
  },
}));
const modules = import.meta.glob("../convex/**/*.ts");
const authModules = import.meta.glob("../convex/betterAuth/**/*.ts");
const connect = makeFunctionReference<"action">("providers:connect");
const research = makeFunctionReference<"action">("providers:research");
const snapshot = makeFunctionReference<"query">("workspace:snapshot");
const command = makeFunctionReference<"mutation">("workspace:command");
const connectArgs = {
  workspaceId: "tenant-a",
  provider: "context",
  secret: "",
  resourceId: "",
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

async function setup() {
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-only-secret-long-enough-for-auth");
  vi.stubEnv("EVE_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("CONTEXT_DEV_API_KEY", "test-deployment-context-key");
  retrieve.mockResolvedValue({
    status: "ok",
    request_id: "research-request",
    brand: {
      title: "Example company",
      description: "Verified company description.",
    },
  });
  const t = convexTest(schema, modules);
  t.registerComponent("betterAuth", authSchema, authModules);
  const now = Date.now();
  const create = (model: string, data: Record<string, unknown>) =>
    t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: { model, data },
      } as never),
    );
  const user = await create("user", {
    name: "Owner",
    email: "owner@company.test",
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  const session = await create("session", {
    token: "context-test-session",
    userId: user._id,
    expiresAt: now + 3600000,
    createdAt: now,
    updatedAt: now,
  });
  await create("member", {
    userId: user._id,
    organizationId: "org-a",
    role: "owner",
    createdAt: now,
  });
  for (const [id, org] of [
    ["tenant-a", "org-a"],
    ["tenant-b", "org-b"],
  ]) {
    const state = createWorkspace(
      id,
      id,
      {
        id: user._id,
        name: "Owner",
        email: "owner@company.test",
      },
      now,
      org,
    );
    state.businessProfiles[0].website = "https://company.com";
    await t.run((ctx) => saveState(ctx.db, state));
  }
  return {
    t,
    owner: t.withIdentity({ subject: user._id, sessionId: session._id }),
  };
}

it("uses a verified deployment key without persisting it or granting access to another tenant", async () => {
  const { t, owner } = await setup();
  await owner.action(connect, connectArgs);
  await owner.action(research, {
    workspaceId: "tenant-a",
    url: "https://company.com",
  });
  expect(
    retrieve.mock.calls.every(([key]) => key === "test-deployment-context-key"),
  ).toBe(true);
  const view = await owner.query(snapshot, {});
  expect(
    view.data.connections.find(
      (c: { provider: string }) => c.provider === "context",
    ),
  ).toMatchObject({
    scope: "deployment",
    status: "healthy",
    owner: "Deployment owner",
  });
  expect(JSON.stringify(view)).not.toContain("test-deployment-context-key");
  expect(await t.run((ctx) => ctx.db.query("credentials").collect())).toEqual(
    [],
  );
  const calls = retrieve.mock.calls.length;
  await expect(
    owner.action(connect, { ...connectArgs, workspaceId: "tenant-b" }),
  ).rejects.toThrow("Workspace unavailable");
  await expect(t.action(connect, connectArgs)).rejects.toThrow(
    "Unauthenticated",
  );
  expect(retrieve).toHaveBeenCalledTimes(calls);
});

it("keeps a workspace override isolated and removes it when the owner selects deployment billing", async () => {
  const { t, owner } = await setup();
  await owner.action(connect, {
    ...connectArgs,
    secret: "test-workspace-context-key",
  });
  await owner.action(research, {
    workspaceId: "tenant-a",
    url: "https://company.com",
  });
  expect(retrieve.mock.calls.at(-1)?.[0]).toBe("test-workspace-context-key");
  const credentials = await t.run((ctx) =>
    ctx.db.query("credentials").collect(),
  );
  expect(credentials).toHaveLength(1);
  expect(credentials[0].ciphertext).not.toContain("test-workspace-context-key");

  // A missing workspace credential must not charge the deployment account instead.
  await t.run((ctx) => ctx.db.delete(credentials[0]._id));
  retrieve.mockClear();
  await expect(
    owner.action(research, {
      workspaceId: "tenant-a",
      url: "https://company.com",
    }),
  ).rejects.toThrow("Connect your context account first");
  expect(retrieve).not.toHaveBeenCalled();

  await owner.action(connect, {
    ...connectArgs,
    secret: "test-workspace-context-key",
  });
  await owner.action(connect, connectArgs);
  expect(await t.run((ctx) => ctx.db.query("credentials").collect())).toEqual(
    [],
  );
  await owner.action(research, {
    workspaceId: "tenant-a",
    url: "https://company.com",
  });
  expect(retrieve.mock.calls.at(-1)?.[0]).toBe("test-deployment-context-key");
});

it("requires an active workspace connection even when the deployment key is configured", async () => {
  const { owner } = await setup();
  await expect(
    owner.action(research, {
      workspaceId: "tenant-a",
      url: "https://company.com",
    }),
  ).rejects.toThrow("Connect Context.dev");
  expect(retrieve).not.toHaveBeenCalled();
  await owner.action(connect, connectArgs);
  await owner.mutation(command, {
    workspaceId: "tenant-a",
    command: { type: "disconnect", connectionId: "connection-context" },
  });
  retrieve.mockClear();
  await expect(
    owner.action(research, {
      workspaceId: "tenant-a",
      url: "https://company.com",
    }),
  ).rejects.toThrow("Connect Context.dev");
  expect(retrieve).not.toHaveBeenCalled();
});

it("fails verification safely without exposing provider errors or marking the connection healthy", async () => {
  const { owner } = await setup();
  vi.stubEnv("CONTEXT_DEV_API_KEY", "");
  await expect(owner.action(connect, connectArgs)).rejects.toThrow(
    "Set CONTEXT_DEV_API_KEY",
  );
  expect(retrieve).not.toHaveBeenCalled();
  vi.stubEnv("CONTEXT_DEV_API_KEY", "test-deployment-context-key");
  retrieve.mockRejectedValueOnce(
    new Error("Vendor error with private details"),
  );
  await expect(owner.action(connect, connectArgs)).rejects.toThrow(
    "Context.dev could not verify the key and business website.",
  );
  const view = await owner.query(snapshot, {});
  expect(
    view.data.connections.find(
      (c: { provider: string }) => c.provider === "context",
    ).status,
  ).toBe("disconnected");
});
