"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  ArrowUpRight,
  Check,
  Plus,
  FileText,
  Upload,
  Copy,
  Code2,
  ShieldCheck,
  History,
  Palette,
  Globe,
  Download,
  ArrowRight,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useEve } from "../eve-provider";
import { useEveHref } from "../shell";
import { Badge, Button, Field, Input, SectionTitle, Modal, cn } from "../ui";
import { currentPolicy } from "@/domain/engine";
import { setupPrompt } from "@/domain/instrumentation";
import { shortDate, titleCase } from "@/lib/format";
import type { Dataset } from "@/domain/schema";
export function Playbook() {
  const { data, command, now, busy, role } = useEve(),
    href = useEveHref(),
    params = useSearchParams(),
    router = useRouter();
  const tab = params.get("tab") ?? "business",
    profile = data.businessProfiles[0],
    policy = currentPolicy(data),
    brand = data.brandProfiles.at(-1)!;
  const [draft, setDraft] = useState(profile),
    [brandDraft, setBrand] = useState(brand),
    [promptOpen, setPromptOpen] = useState(false),
    [signalOpen, setSignalOpen] = useState(false),
    [signalName, setSignalName] = useState(""),
    [signalLabel, setSignalLabel] = useState(""),
    [signalMeaning, setSignalMeaning] =
      useState<Dataset["signalDefinitions"][number]["meaning"]>("activation"),
    [signalDescription, setSignalDescription] = useState("");
  const [threshold, setThreshold] = useState(policy.minEmployees);
  const readOnly = !["owner", "admin"].includes(role);
  const ingestUrl = `${process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "https://YOUR_DEPLOYMENT.convex.site"}/events`;
  const save = async () => {
    try {
      await command({
        type: "business",
        profile: { ...draft, confirmed: true },
      });
      toast.success("Business brief saved.");
    } catch {}
  };
  const tabs = [
    ["business", "Business brief"],
    ["signals", "Signals"],
    ["knowledge", "Knowledge"],
    ["voice", "Voice & offers"],
    ["brand", "Brand"],
    ["authority", "Authority"],
  ];
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">A SHARED UNDERSTANDING</div>
          <h1>The playbook</h1>
          <p>
            Your business, your boundaries, and what a good next move looks
            like.
          </p>
        </div>
        <Badge tone="green">
          <ShieldCheck size={12} />
          Policy v{policy.version}
        </Badge>
      </div>
      <div className="account-tabs">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className={cn(tab === id && "active")}
            onClick={() =>
              router.replace(href(`/playbook?tab=${id}`), { scroll: false })
            }
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "business" && (
        <div className="settings-grid">
          <section className="settings-card">
            <SectionTitle
              title="Here’s what Eve understands"
              subtitle="Keep the context accurate. Eve will use it in every account decision."
            />
            <Field label="Business name">
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label="Website">
              <Input
                value={draft.website}
                onChange={(e) =>
                  setDraft({ ...draft, website: e.target.value })
                }
              />
            </Field>
            <Field label="What you do">
              <textarea
                className="input"
                rows={4}
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </Field>
            <Field label="What should Eve optimize for?">
              <Input
                value={draft.goal}
                onChange={(e) => setDraft({ ...draft, goal: e.target.value })}
              />
            </Field>
            <Field label="Your ideal customer">
              <textarea
                className="input"
                rows={3}
                value={draft.icp}
                onChange={(e) => setDraft({ ...draft, icp: e.target.value })}
              />
            </Field>
            <Field
              label="Who should Eve never contact?"
              hint="One exclusion per line."
            >
              <textarea
                className="input"
                rows={3}
                value={draft.exclusions.join("\n")}
                onChange={(e) =>
                  setDraft({ ...draft, exclusions: e.target.value.split("\n") })
                }
              />
            </Field>
            <Field label="When should Eve prepare a page?">
              <select
                className="input"
                value={draft.pageStrategy}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    pageStrategy: e.target.value as "immediate" | "qualified",
                  })
                }
              >
                <option value="qualified">
                  After a confirmed meaningful signal
                </option>
                <option value="immediate">After signup</option>
              </select>
            </Field>
            <Field
              label="Approved claims"
              hint="One exact claim per line. Each must appear in a ready knowledge source; add supporting material in Knowledge first."
            >
              <textarea
                className="input"
                rows={4}
                defaultValue={draft.approvedClaims
                  .map((c) => c.text)
                  .join("\n")}
                onBlur={(e) => {
                  const lines = e.target.value
                    .split("\n")
                    .map((x) => x.trim())
                    .filter(Boolean);
                  const claims = lines.map((text) => ({
                    text,
                    sourceId:
                      data.knowledgeSources.find(
                        (s) => s.status === "ready" && s.content.includes(text),
                      )?.id ?? "",
                  }));
                  if (claims.some((c) => !c.sourceId)) {
                    toast.error(
                      "Every claim needs an exact supporting passage in Knowledge.",
                    );
                    return;
                  }
                  setDraft({ ...draft, approvedClaims: claims });
                }}
              />
            </Field>
            <Button
              variant="primary"
              onClick={() => void save()}
              disabled={readOnly}
              loading={busy}
            >
              <Check size={14} />
              Confirm & save brief
            </Button>
          </section>
          <aside>
            <div className="settings-note">
              <span className="eve-symbol">e</span>
              <h3>Brief Eve like a teammate.</h3>
              <p>
                A useful brief explains who you help, what they are trying to
                do, and where you can be useful. Specific beats exhaustive.
              </p>
              <div>
                <Badge tone="green">Found on your website</Badge>
                <Badge>You told Eve</Badge>
                <Badge>Imported from a file</Badge>
                <Badge tone="amber">Inferred — confirm</Badge>
              </div>
            </div>
            <div className="settings-card">
              <SectionTitle
                title="Approved claims"
                subtitle="No invented proof, urgency, or metrics."
              />
              {profile.approvedClaims.map((c) => (
                <div className="approved-claim" key={c.text}>
                  <Check size={14} />
                  <div>
                    <p>{c.text}</p>
                    <span>
                      {data.knowledgeSources.find((s) => s.id === c.sourceId)
                        ?.title ?? "Source unavailable"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
      {tab === "signals" && (
        <>
          <div className="signal-intro">
            <div>
              <span className="section-icon">
                <ActivityIcon />
              </span>
              <h2>Behavior first. Meaning second.</h2>
              <p>
                Confirm what a signal means before Eve acts on it. Hypotheses
                remain hypotheses.
              </p>
            </div>
            <div>
              <Button onClick={() => setPromptOpen(true)}>
                <Code2 size={14} />
                Get setup prompt
              </Button>
              <Button
                variant="primary"
                disabled={readOnly}
                onClick={() => setSignalOpen(true)}
              >
                <Plus size={14} />
                Add signal
              </Button>
            </div>
          </div>
          <div className="signal-mappings">
            {data.signalDefinitions.map((s) => (
              <article key={s.id}>
                <div className="signal-event">
                  <code>{s.eventName}</code>
                  <p>{s.description}</p>
                </div>
                <ArrowRight size={15} />
                <div>
                  <strong>{s.label}</strong>
                  <span>{titleCase(s.meaning)}</span>
                </div>
                <Badge tone={s.confirmed ? "green" : "amber"}>
                  {s.confirmed ? "Confirmed" : "Hypothesis"}
                </Badge>
                <Button
                  size="small"
                  variant="ghost"
                  disabled={readOnly}
                  onClick={() =>
                    void command({
                      type: "signal",
                      signal: { ...s, confirmed: !s.confirmed },
                    })
                      .then(() =>
                        toast.success("Signal interpretation updated."),
                      )
                      .catch(() => {})
                  }
                >
                  {s.confirmed ? "Unconfirm" : "Confirm"}
                </Button>
              </article>
            ))}
          </div>
          <div className="connection-callout">
            <ShieldCheck size={18} />
            <p>
              Missing telemetry is never treated as disengagement. A friction
              signal must come from an explicit, confirmed rule.
            </p>
          </div>
        </>
      )}
      {tab === "knowledge" && (
        <>
          <div className="settings-card">
            <SectionTitle
              title="Give Eve the right reference material"
              subtitle="Upload a plain-text or Markdown document. Its source and retrieval chunks stay inspectable."
            />
            <label className="upload-zone">
              <Upload size={25} />
              <strong>Add docs, positioning, or customer proof</strong>
              <span>Markdown or text · up to 200 KB · no credentials</span>
              <input
                type="file"
                accept=".md,.txt,text/plain,text/markdown"
                disabled={readOnly}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 200000) {
                    toast.error("Please choose a file under 200 KB.");
                    return;
                  }
                  const content = await f.text();
                  try {
                    await command({
                      type: "knowledge",
                      source: {
                        id: `source-${now}-${data.knowledgeSources.length}`,
                        workspaceId: data.workspace.id,
                        title: f.name,
                        kind: "file",
                        content,
                        status: "ready",
                        createdAt: now,
                      },
                    });
                    toast.success("Source added and indexed for retrieval.");
                  } catch {}
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="source-list">
            {data.knowledgeSources.map((s) => (
              <div key={s.id}>
                <FileText size={20} />
                <div>
                  <strong>{s.title}</strong>
                  <p>
                    {s.url ??
                      `${s.content.length.toLocaleString()} characters · ${data.knowledgeChunks.filter((c) => c.sourceId === s.id).length} retrieval chunks`}
                  </p>
                </div>
                <Badge tone={s.status === "ready" ? "green" : "amber"}>
                  {s.status}
                </Badge>
                <Badge>{s.kind}</Badge>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "voice" && (
        <div className="settings-grid">
          <section className="settings-card">
            <SectionTitle
              title="Sound like your team"
              subtitle="Every email passes a deterministic writing check."
            />
            <Field label="Writing rules" hint="One instruction per line.">
              <textarea
                className="input"
                rows={7}
                value={draft.writingRules.join("\n")}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    writingRules: e.target.value.split("\n"),
                  })
                }
              />
            </Field>
            <Field label="Never say">
              <textarea
                className="input"
                rows={5}
                value={draft.prohibitedPhrases.join("\n")}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    prohibitedPhrases: e.target.value
                      .split("\n")
                      .filter(Boolean),
                  })
                }
              />
            </Field>
            <Field label="When should Eve prepare a page?">
              <select
                className="input"
                value={draft.pageStrategy}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    pageStrategy: e.target.value as "immediate" | "qualified",
                  })
                }
              >
                <option value="qualified">
                  After a confirmed meaningful signal
                </option>
                <option value="immediate">After signup</option>
              </select>
            </Field>
            <Field
              label="Approved claims"
              hint="One exact claim per line. Each must appear in a ready knowledge source; add supporting material in Knowledge first."
            >
              <textarea
                className="input"
                rows={4}
                defaultValue={draft.approvedClaims
                  .map((c) => c.text)
                  .join("\n")}
                onBlur={(e) => {
                  const lines = e.target.value
                    .split("\n")
                    .map((x) => x.trim())
                    .filter(Boolean);
                  const claims = lines.map((text) => ({
                    text,
                    sourceId:
                      data.knowledgeSources.find(
                        (s) => s.status === "ready" && s.content.includes(text),
                      )?.id ?? "",
                  }));
                  if (claims.some((c) => !c.sourceId)) {
                    toast.error(
                      "Every claim needs an exact supporting passage in Knowledge.",
                    );
                    return;
                  }
                  setDraft({ ...draft, approvedClaims: claims });
                }}
              />
            </Field>
            <Button
              variant="primary"
              onClick={() => void save()}
              disabled={readOnly}
            >
              Save writing rules
            </Button>
          </section>
          <section className="settings-card">
            <SectionTitle
              title="A useful offer"
              subtitle="Only make promises your team has approved."
            />
            <Field label="Approved offer">
              <textarea
                className="input"
                rows={4}
                value={draft.offer}
                onChange={(e) => setDraft({ ...draft, offer: e.target.value })}
              />
            </Field>
            <Field
              label="Approved CTA destination"
              hint="HTTPS URL or mailto address."
            >
              <Input
                value={draft.cta}
                onChange={(e) => setDraft({ ...draft, cta: e.target.value })}
              />
            </Field>
            <Field label="When should personalized pages be prepared?">
              <select
                className="input"
                value={draft.pageStrategy}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    pageStrategy: e.target.value as "qualified" | "immediate",
                  })
                }
              >
                <option value="qualified">
                  Qualified — wait for meaningful product context
                </option>
                <option value="immediate">
                  Immediate — prepare when the account is resolved
                </option>
              </select>
            </Field>
            <Button
              variant="primary"
              disabled={readOnly}
              onClick={() => void save()}
            >
              Save offer & generation strategy
            </Button>
          </section>
        </div>
      )}
      {tab === "brand" && (
        <div className="settings-grid">
          <section className="settings-card">
            <SectionTitle
              title="Your brand, made personal"
              subtitle={`Current version ${brand.version}. Published pages preserve their original version.`}
            />
            <Field label="Brand name">
              <Input
                value={brandDraft.name}
                onChange={(e) =>
                  setBrand({ ...brandDraft, name: e.target.value })
                }
              />
            </Field>
            <div className="form-two">
              <Field label="Primary color">
                <Input
                  type="color"
                  value={brandDraft.primary}
                  onChange={(e) =>
                    setBrand({ ...brandDraft, primary: e.target.value })
                  }
                />
              </Field>
              <Field label="Page background">
                <Input
                  type="color"
                  value={brandDraft.background}
                  onChange={(e) =>
                    setBrand({ ...brandDraft, background: e.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="Typography">
              <select
                className="input"
                value={brandDraft.font}
                onChange={(e) =>
                  setBrand({
                    ...brandDraft,
                    font: e.target.value as "geist" | "serif",
                  })
                }
              >
                <option value="geist">Geist — clear and considered</option>
                <option value="serif">Editorial serif</option>
              </select>
            </Field>
            <Button
              variant="primary"
              disabled={readOnly}
              onClick={() =>
                void command({
                  type: "brand",
                  brand: { ...brandDraft, confirmed: true },
                })
                  .then(() => toast.success("Brand saved as a new version."))
                  .catch(() => {})
              }
            >
              Confirm brand profile
            </Button>
          </section>
          <div
            className="brand-preview"
            style={{
              background: brandDraft.primary,
              color: brandDraft.background,
              fontFamily:
                brandDraft.font === "serif" ? "Georgia,serif" : undefined,
            }}
          >
            <span>{brandDraft.name}</span>
            <h2>
              A familiar voice.
              <br />A more relevant
              <br />
              experience.
            </h2>
            <p>Personalized pages, grounded in your business.</p>
            <button
              style={{
                background: brandDraft.background,
                color: brandDraft.primary,
              }}
            >
              Let’s get started
              <ArrowUpRight size={16} />
            </button>
          </div>
        </div>
      )}
      {tab === "authority" && (
        <div className="settings-grid">
          <div>
            <section className="settings-card">
              <SectionTitle
                title="Room to act. Clear boundaries."
                subtitle="Authority is explicit. A past approval never bypasses a current safety check."
              />
              <div className="authority-options">
                {(["observe", "copilot", "autopilot"] as const).map((mode) => (
                  <button
                    key={mode}
                    className={cn(
                      "authority-option",
                      policy.mode === mode && "selected",
                    )}
                    disabled={readOnly}
                    onClick={() =>
                      void command({ type: "authority", mode }).catch(() => {})
                    }
                  >
                    <ShieldCheck size={18} />
                    <div>
                      <strong>{titleCase(mode)}</strong>
                      <p>
                        {mode === "observe"
                          ? "Analyze and draft. No external effects."
                          : mode === "copilot"
                            ? "Prepare actions for a human to approve."
                            : "Execute approved policy. Escalate exceptions."}
                      </p>
                    </div>
                    {policy.mode === mode && <Check size={17} />}
                  </button>
                ))}
              </div>
              <div className="channel-overrides">
                <h3>Per-action authority</h3>
                {(["email", "page", "call", "crm"] as const).map((kind) => (
                  <label key={kind}>
                    <span>{titleCase(kind)}</span>
                    <select
                      className="input"
                      value={policy.overrides[kind] ?? "default"}
                      disabled={readOnly}
                      onChange={(e) => {
                        const overrides = { ...policy.overrides };
                        if (e.target.value === "default")
                          delete overrides[kind];
                        else
                          overrides[kind] = e.target.value as
                            "observe" | "copilot" | "autopilot";
                        void command({
                          type: "authority",
                          mode: policy.mode,
                          overrides,
                        }).catch(() => {});
                      }}
                    >
                      <option value="default">Workspace default</option>
                      <option value="observe">Observe</option>
                      <option value="copilot">Copilot</option>
                      <option value="autopilot">Autopilot</option>
                    </select>
                  </label>
                ))}
              </div>
            </section>
            <section className="settings-card">
              <SectionTitle
                title="Proposed changes"
                subtitle="Inspect the diff. Then choose the scope."
              />
              {data.policyProposals
                .filter((p) => p.status === "pending")
                .map((p) => (
                  <div className="policy-diff" key={p.id}>
                    <strong>{p.title}</strong>
                    <div className="diff-removed">− {p.before}</div>
                    <div className="diff-added">+ {p.after}</div>
                    <div className="policy-diff-actions">
                      <Button
                        size="small"
                        disabled={readOnly}
                        onClick={() =>
                          void command({
                            type: "resolve_policy",
                            proposalId: p.id,
                            approve: false,
                          }).catch(() => {})
                        }
                      >
                        Reject
                      </Button>
                      <Button
                        size="small"
                        variant="primary"
                        disabled={readOnly}
                        onClick={() =>
                          void command({
                            type: "resolve_policy",
                            proposalId: p.id,
                            approve: true,
                          }).catch(() => {})
                        }
                      >
                        Approve policy change
                      </Button>
                    </div>
                  </div>
                ))}
              {!data.policyProposals.some((p) => p.status === "pending") && (
                <p className="muted">
                  No policy changes are waiting for review.
                </p>
              )}
            </section>
          </div>
          <aside>
            <section className="settings-card">
              <SectionTitle title="Always-on safeguards" />
              <ul className="safeguard-list">
                {[
                  "Workspace and account isolation",
                  "Unsubscribe and suppression enforced",
                  `${policy.maxContactPerDay} touch per contact, ${policy.maxAccountPerDay} per account per day`,
                  `Quiet hours: ${policy.quietStart}:00–${policy.quietEnd}:00 ${data.workspace.timezone}`,
                  "Replies and conversions cancel stale actions",
                  "Duplicate external actions prevented",
                  "Uncertain provider results require reconciliation",
                ].map((x) => (
                  <li key={x}>
                    <Check size={14} />
                    {x}
                  </li>
                ))}
              </ul>
            </section>
            <section className="settings-card">
              <SectionTitle title="Qualification threshold" />
              <Field label="Minimum company size">
                <Input
                  type="number"
                  min={0}
                  max={100000}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                />
              </Field>
              <Button
                disabled={readOnly || threshold === policy.minEmployees}
                onClick={() =>
                  void command({
                    type: "propose_policy",
                    proposal: {
                      id: `proposal-${now}-${data.policyProposals.length}`,
                      workspaceId: data.workspace.id,
                      title: "Update company-size qualification",
                      changes: { minEmployees: threshold },
                      before: `Qualify accounts with ${policy.minEmployees}+ employees`,
                      after: `Qualify accounts with ${threshold}+ employees`,
                      status: "pending",
                      createdAt: now,
                    },
                  })
                    .then(() => toast.success("Diff prepared for review."))
                    .catch(() => {})
                }
              >
                Propose a change
              </Button>
            </section>
            <section className="settings-card">
              <SectionTitle title="Policy history" />
              {data.policies
                .slice()
                .reverse()
                .map((p) => (
                  <div className="policy-history" key={p.id}>
                    <History size={14} />
                    <div>
                      <strong>
                        Version {p.version} · {titleCase(p.mode)}
                      </strong>
                      <p>
                        {p.actor} · {shortDate(p.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
            </section>
          </aside>
        </div>
      )}
      <Modal
        open={promptOpen}
        onOpenChange={setPromptOpen}
        title="A setup prompt that knows your business"
        description="Generated from your confirmed goals and signal definitions. No secrets are included."
        wide
      >
        <div className="prompt-content">
          <pre>{setupPrompt(data, ingestUrl)}</pre>
        </div>
        <div className="review-footer">
          <span>Use with your preferred coding agent.</span>
          <Button
            variant="primary"
            onClick={() =>
              void navigator.clipboard
                .writeText(setupPrompt(data, ingestUrl))
                .then(() => toast.success("Setup prompt copied."))
                .catch(() =>
                  toast.error(
                    "Clipboard unavailable; select and copy the text.",
                  ),
                )
            }
          >
            <Copy size={14} />
            Copy setup prompt
          </Button>
        </div>
      </Modal>
      <Modal
        open={signalOpen}
        onOpenChange={setSignalOpen}
        title="Define a meaningful signal"
        description="Separate the event you observe from the interpretation you approve."
      >
        <Field label="Existing event name">
          <Input
            value={signalName}
            onChange={(e) => setSignalName(e.target.value)}
            placeholder="first_api_request_succeeded"
          />
        </Field>
        <Field label="Meaningful label">
          <Input
            value={signalLabel}
            onChange={(e) => setSignalLabel(e.target.value)}
            placeholder="Activated"
          />
        </Field>
        <Field label="Interpretation">
          <select
            className="input"
            value={signalMeaning}
            onChange={(e) =>
              setSignalMeaning(e.target.value as typeof signalMeaning)
            }
          >
            {[
              "signup",
              "activation",
              "friction",
              "intent",
              "expansion",
              "disengagement",
            ].map((x) => (
              <option key={x} value={x}>
                {titleCase(x)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Exact definition">
          <textarea
            className="input"
            rows={3}
            value={signalDescription}
            onChange={(e) => setSignalDescription(e.target.value)}
          />
        </Field>
        <div className="modal-actions">
          <Button
            variant="primary"
            disabled={!signalName || !signalLabel || !signalDescription}
            onClick={() =>
              void command({
                type: "signal",
                signal: {
                  id: `signal-${now}-${data.signalDefinitions.length}`,
                  workspaceId: data.workspace.id,
                  eventName: signalName,
                  label: signalLabel,
                  meaning: signalMeaning,
                  description: signalDescription,
                  confirmed: true,
                },
              })
                .then(() => {
                  setSignalOpen(false);
                  toast.success("Signal confirmed.");
                })
                .catch(() => {})
            }
          >
            Confirm signal
          </Button>
        </div>
      </Modal>
    </div>
  );
}
function ActivityIcon() {
  return <Settings2 size={22} />;
}
