import { describe, it, expect, vi, afterEach } from "vitest";
import { demoData, DEMO_NOW as now } from "../src/demo/demo-data";
import { DemoRepository } from "../src/demo/adapter";
import {
  assertDataset,
  applyCommand,
  claimAction,
  finishAction,
  ingest,
  recordOutcome,
  validatePage,
  preflight,
  currentPolicy,
  proposeCrm,
  writingGate,
} from "../src/domain/engine";
import {
  datasetSchema,
  type Dataset,
  type ProductEvent,
} from "../src/domain/schema";
const actor = { id: "operator-test", role: "operator" as const };
const admin = { id: "admin-test", role: "admin" as const };
const fresh = () => structuredClone(demoData);
const emailId = demoData.actions.find(
  (a) => a.accountId === "acme" && a.kind === "email",
)!.id;
const pageId = demoData.actions.find(
  (a) => a.accountId === "acme" && a.kind === "page",
)!.id;
const approve = (s: Dataset, id = emailId) => {
  if (id === emailId) s.pageSpecs[0].status = "published";
  return applyCommand(s, { type: "approve", actionId: id }, actor, now);
};
const event = (overrides: Partial<ProductEvent> = {}): ProductEvent => ({
  workspaceId: demoData.workspace.id,
  eventId: "test-event",
  eventName: "first_api_request_succeeded",
  occurredAt: now,
  userEmail: "sarah@acme.example",
  userId: "user-acme",
  properties: {},
  ...overrides,
});

describe("canonical schema and tenant boundaries", () => {
  it("validates every fixture and relation", () =>
    expect(assertDataset(datasetSchema.parse(demoData))).toEqual(demoData));
  it("rejects records and events from a different tenant", () => {
    const s = fresh();
    s.contacts[0].workspaceId = "other";
    expect(() => assertDataset(s)).toThrow("Cross-workspace");
    expect(() => ingest(fresh(), event({ workspaceId: "other" }), now)).toThrow(
      "workspace",
    );
  });
  it("refuses contradictory identities rather than merging companies", () =>
    expect(() =>
      ingest(fresh(), event({ companyDomain: "orbit.example" }), now),
    ).toThrow("different accounts"));
  it("keeps personal email unresolved without company evidence", () => {
    const result = ingest(
      fresh(),
      event({ userId: "unknown", userEmail: "someone@gmail.com" }),
      now,
    );
    expect(result.accountId).toBeUndefined();
    expect(result.state.accounts).toHaveLength(demoData.accounts.length);
  });
  it("rejects stale timestamps and sensitive properties", () => {
    expect(() =>
      ingest(fresh(), event({ occurredAt: now - 91 * 86400000 }), now),
    ).toThrow("timestamp");
    expect(() =>
      ingest(fresh(), event({ properties: { api_key: "secret" } }), now),
    ).toThrow("sensitive");
  });
});
describe("durable intended actions", () => {
  it("deduplicates replays without another proposal or audit entry", () => {
    const first = ingest(fresh(), event(), now);
    const second = ingest(first.state, event(), now);
    expect(second.duplicate).toBe(true);
    expect(second.state).toBe(first.state);
  });
  it("claims at most once and reconciles the external reference", () => {
    const first = claimAction(approve(fresh()), emailId, now);
    expect(first.claimed).toBe(true);
    expect(claimAction(first.state, emailId, now).claimed).toBe(false);
    const done = finishAction(
      first.state,
      emailId,
      { providerId: "provider-message-1" },
      now,
    );
    expect(done.actions.find((a) => a.id === emailId)).toMatchObject({
      status: "succeeded",
      providerId: "provider-message-1",
      attempts: 1,
    });
    expect(finishAction(done, emailId, { providerId: "duplicate" }, now)).toBe(
      done,
    );
  });
  it("never automatically retries an ambiguous external result", () => {
    const claimed = claimAction(approve(fresh()), emailId, now);
    const failed = finishAction(
      claimed.state,
      emailId,
      { providerId: "", error: "timeout" },
      now,
    );
    expect(failed.actions.find((a) => a.id === emailId)).toMatchObject({
      status: "failed",
      retrySafe: false,
    });
    expect(claimAction(failed, emailId, now).claimed).toBe(false);
  });
  it("blocks an approved action after pause, unsubscribe, or customer conversion", () => {
    let s = approve(fresh());
    s = applyCommand(s, { type: "pause", paused: true }, actor, now);
    expect(claimAction(s, emailId, now).claimed).toBe(false);
    s = recordOutcome(
      approve(fresh()),
      "acme",
      "unsubscribe",
      "stop",
      "unsub",
      now,
    );
    expect(s.actions.find((a) => a.id === emailId)?.status).toBe("cancelled");
    expect(claimAction(s, emailId, now).claimed).toBe(false);
    s = applyCommand(
      approve(fresh()),
      { type: "customer", accountId: "acme" },
      actor,
      now,
    );
    expect(s.actions.find((a) => a.id === emailId)?.status).toBe("cancelled");
  });
  it("cancels a scheduled follow-up when a reply arrives and deduplicates its webhook", () => {
    let s = claimAction(approve(fresh()), emailId, now).state;
    s = finishAction(s, emailId, { providerId: "sent" }, now);
    const follow = s.actions.find((a) => a.parentActionId === emailId)!;
    expect(follow.status).toBe("pending_approval");
    s = applyCommand(s, { type: "approve", actionId: follow.id }, actor, now);
    s = recordOutcome(s, "acme", "reply", "Thanks", "message-1", now + 1000);
    expect(s.actions.find((a) => a.id === follow.id)?.status).toBe("cancelled");
    expect(
      recordOutcome(s, "acme", "reply", "Thanks", "message-1", now + 1000),
    ).toBe(s);
  });
  it("cancels obsolete outreach and prepares CRM when activation arrives", () => {
    const s = ingest(approve(fresh()), event(), now).state;
    expect(s.accounts.find((a) => a.id === "acme")?.stage).toBe("activated");
    expect(s.actions.find((a) => a.id === emailId)?.status).toBe("cancelled");
    expect(s.crmChanges.some((c) => c.accountId === "acme")).toBe(true);
  });
  it("separates activation help from later commercial intent", () => {
    let s = ingest(fresh(), event(), now).state;
    s = ingest(
      s,
      event({ eventId: "pricing", eventName: "pricing_viewed" }),
      now,
    ).state;
    expect(s.accounts[0].stage).toBe("activated");
    s = ingest(
      s,
      event({ eventId: "teammate", eventName: "teammate_invited" }),
      now,
    ).state;
    expect(s.accounts[0].stage).toBe("qualified");
    expect(
      s.actions.some(
        (a) => a.accountId === "acme" && a.id.includes("assisted-conversion"),
      ),
    ).toBe(true);
  });
  it("does not infer friction from missing events", () => {
    const s = ingest(
      fresh(),
      event({
        eventId: "new-user",
        userId: "new-user",
        userEmail: "new@newco.example",
        eventName: "docs_viewed",
      }),
      now,
    ).state;
    expect(s.actions.some((a) => a.accountId === "account-newco-example")).toBe(
      false,
    );
  });
  it("serializes independent CRM operations for the same company", () => {
    let s = fresh();
    proposeCrm(s, s.accounts[0], now, "one");
    proposeCrm(s, s.accounts[0], now, "two");
    const actions = s.actions.filter(
      (a) => a.accountId === "acme" && a.kind === "crm",
    );
    for (const a of actions) s = approve(s, a.id);
    const first = claimAction(s, actions[0].id, now);
    expect(first.claimed).toBe(true);
    expect(claimAction(first.state, actions[1].id, now).claimed).toBe(false);
  });
});
describe("authority and content gates", () => {
  it("restricts viewer and operator mutations", () => {
    expect(() =>
      applyCommand(
        fresh(),
        { type: "pause", paused: true },
        { id: "reader", role: "viewer" },
        now,
      ),
    ).toThrow("Viewers");
    expect(() =>
      applyCommand(
        fresh(),
        { type: "authority", mode: "autopilot" },
        actor,
        now,
      ),
    ).toThrow("admin");
  });
  it("invalidates approvals after policy or business changes", () => {
    const s = applyCommand(
      approve(fresh()),
      { type: "business", profile: demoData.businessProfiles[0] },
      admin,
      now,
    );
    expect(currentPolicy(s).version).toBe(2);
    expect(s.actions.find((a) => a.id === emailId)?.approvedBy).toBeUndefined();
    expect(claimAction(s, emailId, now).claimed).toBe(false);
  });
  it("uses per-channel authority and keeps Observe non-executing", () => {
    let s = fresh();
    s.policies[0].mode = "observe";
    expect(() => approve(s)).toThrow("Copilot");
    s.policies[0].overrides.email = "copilot";
    expect(claimAction(approve(s), emailId, now).claimed).toBe(true);
  });
  it("checks eligibility, quiet hours and frequency caps at dispatch", () => {
    for (const change of [
      (s: Dataset) => {
        s.accounts[0].employees = 2;
      },
      (s: Dataset) => {
        s.policies[0].requireIntent = true;
      },
      (s: Dataset) => {
        s.policies[0].quietStart = 9;
        s.policies[0].quietEnd = 12;
      },
      (s: Dataset) => {
        s.contacts[0].suppressed = true;
      },
    ]) {
      const s = approve(fresh());
      change(s);
      expect(
        preflight(
          s,
          s.actions.find((a) => a.id === emailId)!,
          now,
        ).allowed,
      ).toBe(false);
    }
  });
  it("preserves immutable revisions and removes approval after editing", () => {
    const before = approve(fresh());
    const old = before.actions.find((a) => a.id === emailId)!.artifactId;
    const after = applyCommand(
      before,
      {
        type: "edit",
        actionId: emailId,
        title: "Revised subject",
        body: "A more useful draft.",
      },
      actor,
      now,
    );
    expect(after.artifacts.find((a) => a.id === old)).toEqual(
      before.artifacts.find((a) => a.id === old),
    );
    expect(
      after.actions.find((a) => a.id === emailId)?.approvedBy,
    ).toBeUndefined();
  });
  it("expires approval and respects future schedules", () => {
    const s = approve(fresh());
    const a = s.actions.find((a) => a.id === emailId)!;
    a.scheduledAt = now + 3600000;
    expect(claimAction(s, a.id, now).claimed).toBe(false);
    expect(
      claimAction(s, a.id, a.expiresAt).state.actions.find((x) => x.id === a.id)
        ?.status,
    ).toBe("expired");
  });
  it("rejects arbitrary components, scripts, unsupported claims and cycles", () => {
    const s = fresh(),
      page = structuredClone(s.pageSpecs[0].spec);
    expect(validatePage(s, page)).toEqual([]);
    page.elements.cta.props.ctaHref = "javascript:alert(1)";
    expect(validatePage(s, page).length).toBeGreaterThan(0);
    page.elements.root.children = ["root"];
    expect(validatePage(s, page).join()).toContain("cycle");
    expect(
      validatePage(s, {
        root: "x",
        elements: { x: { type: "script", props: {} } },
      }).length,
    ).toBeGreaterThan(0);
  });
  it("rechecks page publication atomically after a late pause", () => {
    const s = claimAction(approve(fresh(), pageId), pageId, now).state;
    s.workspace.paused = true;
    const done = finishAction(s, pageId, { providerId: "page" }, now);
    expect(done.pageSpecs[0].status).not.toBe("published");
  });
  it("blocks placeholders, prohibited phrasing and ungrounded drafts", () => {
    const s = fresh(),
      a = structuredClone(s.artifacts.find((a) => a.kind === "email")!);
    a.body = "I noticed that {{name}}";
    a.sourceIds = [];
    expect(writingGate(s, a).length).toBeGreaterThanOrEqual(3);
  });
  it("requires explicit calling consent and records its provenance", () => {
    const s = applyCommand(
      fresh(),
      {
        type: "prepare_call",
        accountId: "acme",
        phone: "+14155550100",
        consent: true,
        consentNote: "Requested a call in the support conversation.",
      },
      actor,
      now,
    );
    expect(s.contacts[0].phoneConsent).toBe(true);
    expect(
      s.actions.some(
        (a) => a.kind === "call" && a.status === "pending_approval",
      ),
    ).toBe(true);
    expect(
      s.auditEntries.some((a) => a.title === "Calling consent recorded"),
    ).toBe(true);
  });
});
describe("isolated demo adapter", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("completes the hero loop without network access and resets exactly", async () => {
    const fetch = vi.fn(() => {
      throw new Error("Demo attempted network");
    });
    vi.stubGlobal("fetch", fetch);
    const repo = new DemoRepository();
    await repo.command({ type: "approve", actionId: pageId });
    await repo.command({ type: "approve", actionId: emailId });
    expect(
      repo.getSnapshot().actions.find((a) => a.id === emailId)?.status,
    ).toBe("succeeded");
    await repo.event(event());
    const crm = repo
      .getSnapshot()
      .actions.find((a) => a.accountId === "acme" && a.kind === "crm")!;
    await repo.command({ type: "approve", actionId: crm.id });
    expect(
      repo.getSnapshot().crmChanges.find((c) => c.actionId === crm.id)?.status,
    ).toBe("synced");
    expect(fetch).not.toHaveBeenCalled();
    repo.reset();
    expect(repo.getSnapshot()).toEqual(demoData);
    expect(repo.now()).toBe(now);
  });
});
