import { it, expect, vi, afterEach } from "vitest";
import { demoData, DEMO_NOW } from "../src/demo/demo-data";
import { writeCrm, sendEmail, recentInboxReply } from "../src/server/providers";
import { proposeCrm, applyCommand, claimAction } from "../src/domain/engine";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("sends exactly the approved artifact with an action reference", async () => {
  const s = structuredClone(demoData),
    a = s.actions.find((a) => a.accountId === "acme" && a.kind === "email")!;
  const fetch = vi.fn(async () =>
    Response.json({ message_id: "message-1", thread_id: "thread-1" }),
  );
  vi.stubGlobal("fetch", fetch);
  expect(await sendEmail(s, a, "mock-credential", "inbox@provider.test")).toBe(
    "message-1",
  );
  const [, options] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  const body = JSON.parse(String(options.body));
  expect(body.text).toBe(s.artifacts.find((x) => x.id === a.artifactId)!.body);
  expect(body.to).toEqual(["sarah@acme.example"]);
  expect(body.headers["X-Eve-Action-Id"]).toBe(a.id);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("uses only the scoped Composio account and guards each CRM write", async () => {
  vi.stubEnv("COMPOSIO_API_KEY", "mock-infrastructure-key");
  const s = structuredClone(demoData);
  proposeCrm(s, s.accounts[0], DEMO_NOW, "test");
  const a = s.actions.find((a) => a.accountId === "acme" && a.kind === "crm")!,
    connection = s.connections.find((c) => c.provider === "hubspot")!;
  const requests: Array<Record<string, unknown>> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, options: RequestInit) => {
      const request = JSON.parse(String(options.body));
      requests.push(request);
      const endpoint = String(request.endpoint);
      const data = endpoint.endsWith("/search")
        ? { results: [] }
        : endpoint.endsWith("/companies")
          ? { id: "company-123" }
          : { id: "record-123" };
      return Response.json({ status: 200, data });
    }),
  );
  const guard = vi.fn(async () => {});
  expect(await writeCrm(s, a, connection, guard)).toBe("company-123");
  expect(
    requests.every(
      (r) => r.connected_account_id === connection.providerAccountId,
    ),
  ).toBe(true);
  expect(
    requests.filter(
      (r) => r.method === "POST" && !String(r.endpoint).endsWith("/search"),
    ),
  ).toHaveLength(3);
  expect(guard).toHaveBeenCalledTimes(3);
});
it("stops before a CRM mutation when the dispatch guard fails", async () => {
  vi.stubEnv("COMPOSIO_API_KEY", "mock-infrastructure-key");
  const s = structuredClone(demoData);
  proposeCrm(s, s.accounts[0], DEMO_NOW, "test");
  const a = s.actions.find((a) => a.accountId === "acme" && a.kind === "crm")!,
    connection = s.connections.find((c) => c.provider === "hubspot")!;
  const fetch = vi.fn(async () =>
    Response.json({ status: 200, data: { results: [] } }),
  );
  vi.stubGlobal("fetch", fetch);
  await expect(
    writeCrm(s, a, connection, async () => {
      throw new Error("Paused");
    }),
  ).rejects.toThrow("Paused");
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("detects a recent reply but ignores substring sender matches", async () => {
  const s = structuredClone(demoData),
    a = s.actions.find((a) => a.accountId === "acme" && a.kind === "email")!;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        threads: [
          {
            thread_id: "wrong",
            senders: ["other-sarah@acme.example"],
            received_timestamp: new Date(DEMO_NOW).toISOString(),
          },
          {
            thread_id: "correct",
            senders: ["Sarah <sarah@acme.example>"],
            received_timestamp: new Date(DEMO_NOW).toISOString(),
          },
        ],
      }),
    ),
  );
  expect((await recentInboxReply(s, a, "mock", "inbox"))?.thread_id).toBe(
    "correct",
  );
});
it("holds email until its approved page is published", () => {
  const s = applyCommand(
    demoData,
    {
      type: "approve",
      actionId: demoData.actions.find(
        (a) => a.accountId === "acme" && a.kind === "email",
      )!.id,
    },
    { id: "operator", role: "operator" },
    DEMO_NOW,
  );
  const a = s.actions.find(
    (a) => a.accountId === "acme" && a.kind === "email",
  )!;
  const result = claimAction(s, a.id, DEMO_NOW);
  expect(result.claimed).toBe(false);
  expect(result.state.actions.find((x) => x.id === a.id)?.error).toContain(
    "Publish",
  );
});
