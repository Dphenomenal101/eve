import { describe, it, expect, vi, afterEach } from "vitest";
import {
  encryptCredential,
  decryptCredential,
  publicWebsite,
  hashIngestKey,
  newIngestKey,
} from "../src/server/credentials";
import { normalizePostHog, readLimitedBody } from "../src/domain/ingestion";
import { providerJson } from "../src/server/providers";
const root = Buffer.alloc(32, 17).toString("base64");
describe("credential envelopes", () => {
  it("authenticates tenant, provider and key without storing plaintext", () => {
    const sealed = encryptCredential(
      "test-secret",
      "tenant-a",
      "agentmail",
      root,
    );
    expect(sealed).not.toContain("test-secret");
    expect(decryptCredential(sealed, "tenant-a", "agentmail", root)).toBe(
      "test-secret",
    );
    expect(() =>
      decryptCredential(sealed, "tenant-b", "agentmail", root),
    ).toThrow();
    expect(() =>
      decryptCredential(sealed, "tenant-a", "retell", root),
    ).toThrow();
    expect(
      encryptCredential("test-secret", "tenant-a", "agentmail", root),
    ).not.toEqual(sealed);
  });
  it("detects tampering and rejects invalid encryption keys", () => {
    const e = JSON.parse(encryptCredential("key", "w", "p", root));
    e.body = Buffer.from("tampered").toString("base64");
    expect(() =>
      decryptCredential(JSON.stringify(e), "w", "p", root),
    ).toThrow();
    expect(() => encryptCredential("x", "w", "p", "invalid")).toThrow(
      "32-byte",
    );
  });
  it("generates distinct ingestion keys and stores only one-way hashes", () => {
    const key = newIngestKey();
    expect(key).not.toBe(newIngestKey());
    expect(hashIngestKey(key)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashIngestKey(key)).not.toContain(key);
  });
  it.each([
    "http://example.com",
    "https://127.0.0.1",
    "https://10.0.0.1",
    "https://[::1]",
    "https://user:pass@example.com",
    "https://service.internal",
  ])("rejects unsafe research URL %s", (url) =>
    expect(() => publicWebsite(url)).toThrow(),
  );
});
describe("ingestion boundary", () => {
  it("requires stable PostHog ids and strips non-allowlisted properties", () => {
    const raw = {
      uuid: "event-1",
      event: "docs_viewed",
      timestamp: new Date().toISOString(),
      distinct_id: "u",
      properties: {
        email: "a@company.com",
        api_key: "never persist",
        page: "quickstart",
      },
    };
    const event = normalizePostHog(raw, "workspace");
    expect(event.properties).toEqual({ page: "quickstart" });
    expect(event.workspaceId).toBe("workspace");
    expect(() => normalizePostHog({ ...raw, uuid: undefined }, "w")).toThrow(
      "stable",
    );
  });
  it("limits body size even without a content-length header", async () => {
    await expect(
      readLimitedBody(
        new Request("https://eve.test", { method: "POST", body: "123456" }),
        5,
      ),
    ).rejects.toThrow("large");
  });
});
describe("provider boundaries", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("does not retry or expose provider error bodies", async () => {
    const mock = vi.fn(
      async () => new Response("token and customer data", { status: 500 }),
    );
    vi.stubGlobal("fetch", mock);
    await expect(
      providerJson("Provider", "https://example.com", "secret"),
    ).rejects.toThrow("HTTP 500");
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
