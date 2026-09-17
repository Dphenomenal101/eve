"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Pause,
  Play,
  Plus,
  Mail,
  Globe,
  Building2,
  Users,
  Activity,
  Clock,
  ShieldCheck,
  Check,
  FileText,
  Database,
  MessageSquare,
  BookOpen,
  ChevronRight,
  ExternalLink,
  FlaskConical,
  ArrowRight,
  Brain,
  GitBranch,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { useEve } from "../eve-provider";
import { useEveHref } from "../shell";
import {
  Avatar,
  Badge,
  Button,
  Field,
  Modal,
  EmptyState,
  SectionTitle,
  cn,
  SearchInput,
} from "../ui";
import { ActionReview, actionIcons } from "../action-review";
import { PrepareCall } from "../prepare-call";
import { PageControls } from "../page-controls";
import { PageRenderer } from "../page-renderer";
import { relativeTime, shortDate, statusTone, titleCase } from "@/lib/format";
export function AccountDetail({ id }: { id: string }) {
  const { data, command, event, outcome, now, demo, busy, generate } = useEve(),
    href = useEveHref(),
    router = useRouter(),
    params = useSearchParams();
  const tab = params.get("tab") ?? "overview",
    setTab = (tab: string) =>
      router.replace(href(`/accounts/${id}?tab=${tab}`), { scroll: false });
  const [review, setReview] = useState<string | null>(null),
    [noteOpen, setNoteOpen] = useState(false),
    [note, setNote] = useState(""),
    [auditQuery, setAuditQuery] = useState(""),
    [simulation, setSimulation] = useState(false);
  const account = data.accounts.find((a) => a.id === id);
  if (!account)
    return (
      <EmptyState
        icon={<Building2 />}
        title="Account not found"
        description="This account may belong to another workspace."
        action={
          <Link href={href("/accounts")} className="btn btn-secondary">
            Back to accounts
          </Link>
        }
      />
    );
  const contacts = data.contacts.filter((c) => c.accountId === id),
    contact = contacts[0],
    actions = data.actions.filter((a) => a.accountId === id),
    events = data.productEvents
      .filter((e) => e.resolvedAccountId === id)
      .sort((a, b) => b.occurredAt - a.occurredAt),
    memories = data.memories.filter((m) => m.accountId === id),
    audit = data.auditEntries
      .filter(
        (a) =>
          a.accountId === id &&
          `${a.title} ${a.detail}`
            .toLowerCase()
            .includes(auditQuery.toLowerCase()),
      )
      .sort((a, b) => b.createdAt - a.createdAt),
    pages = data.pageSpecs.filter((p) => p.accountId === id),
    pending = actions.filter((a) => a.status === "pending_approval");
  async function simulate(type: string) {
    try {
      if (["reply", "booking", "unsubscribe"].includes(type))
        await outcome(
          id,
          type as "reply" | "booking" | "unsubscribe",
          type === "reply"
            ? "Thanks, that helped! We’re working through the quickstart now."
            : type === "booking"
              ? "A setup conversation was booked."
              : "Please stop contacting me.",
        );
      else
        await event({
          eventId: `demo-${id}-${type}-${data.productEvents.length}`,
          workspaceId: data.workspace.id,
          eventName: type,
          occurredAt: now,
          userId: contact?.userId,
          userEmail: contact?.email,
          accountId: id,
          companyDomain: account!.domain,
          properties: {},
        });
      toast.success(
        "Signal received. Account state and planned actions updated.",
      );
      setSimulation(false);
    } catch {}
  }
  return (
    <div className="page account-detail">
      <Link href={href("/accounts")} className="back-link">
        <ArrowLeft size={13} />
        All accounts
      </Link>
      <div className="account-heading">
        <Avatar initials={account.initials} color={account.color} />
        <div>
          <div>
            <h1>{account.name}</h1>
            <Badge tone={statusTone(account.fit)}>
              {titleCase(account.fit)} fit
            </Badge>
            <Badge tone={statusTone(account.stage)}>
              {titleCase(account.stage)}
            </Badge>
          </div>
          <p>
            {account.domain}
            <span>·</span>
            {account.industry}
            {account.employees !== undefined && (
              <>
                <span>·</span>
                {account.employees} employees
              </>
            )}
          </p>
        </div>
        <div className="account-heading-actions">
          {contact && <PrepareCall accountId={id} />}
          {demo && (
            <Button size="small" onClick={() => setSimulation(true)}>
              <FlaskConical size={14} />
              Simulate signal
            </Button>
          )}
          <Button
            size="small"
            onClick={() =>
              void command({
                type: "pause",
                accountId: id,
                paused: !account.paused,
              }).catch(() => {})
            }
          >
            {account.paused ? <Play size={14} /> : <Pause size={14} />}{" "}
            {account.paused ? "Resume account" : "Pause account"}
          </Button>
        </div>
      </div>
      <div className="account-tabs">
        {[
          ["overview", "Overview"],
          ["activity", "Product activity"],
          ["conversation", "Conversations"],
          ["artifacts", "Artifacts"],
          ["memory", "Memory & sources"],
          ["history", "Full history"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={cn(tab === value && "active")}
            onClick={() => setTab(value)}
          >
            {label}
            {value === "artifacts" && (
              <span>
                {data.artifacts.filter((a) => a.accountId === id).length}
              </span>
            )}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <div className="account-columns">
          <div>
            <div className="account-brief">
              <div className="brief-label">
                <span className="eve-symbol small">e</span>
                <span>EVE’S ACCOUNT BRIEF</span>
                <span className="push-right">
                  Updated {relativeTime(account.lastSignalAt, now)}
                </span>
              </div>
              <h2>{account.inferredIntent}</h2>
              <p>{account.summary}</p>
              <div className="evidence-columns">
                <div>
                  <span className="eyebrow">
                    <Activity size={12} />
                    OBSERVED
                  </span>
                  <strong>{account.observedIntent}</strong>
                  <small>Confirmed product activity</small>
                </div>
                <div>
                  <span className="eyebrow">
                    <Brain size={12} />
                    INFERRED
                  </span>
                  <strong>{account.inferredIntent}</strong>
                  <small>
                    {Math.round(account.confidence * 100)}% confidence · open to
                    correction
                  </small>
                </div>
              </div>
            </div>
            <section className="account-section">
              <SectionTitle
                title="The next useful move"
                count={pending.length}
                subtitle="A recommendation you can inspect, change, or stop."
              />
              {actions
                .filter((a) =>
                  ["pending_approval", "scheduled", "draft", "failed"].includes(
                    a.status,
                  ),
                )
                .map((a) => {
                  const Icon = actionIcons[a.kind];
                  return (
                    <button
                      key={a.id}
                      className="account-action"
                      onClick={() => setReview(a.id)}
                    >
                      <span className={`action-kind action-${a.kind}`}>
                        <Icon size={18} />
                      </span>
                      <div>
                        <strong>{a.title}</strong>
                        <p>{a.rationale}</p>
                        <span>
                          {a.scheduledAt && a.scheduledAt > now
                            ? `${shortDate(a.scheduledAt)} UTC`
                            : `Policy v${a.policyVersion} · ${titleCase(a.kind)}`}
                        </span>
                      </div>
                      <div>
                        <Badge tone={statusTone(a.status)}>
                          {titleCase(a.status)}
                        </Badge>
                        <ChevronRight size={16} />
                      </div>
                    </button>
                  );
                })}
              {!actions.some((a) =>
                ["pending_approval", "scheduled", "draft", "failed"].includes(
                  a.status,
                ),
              ) && (
                <div className="quiet-row">
                  <ShieldCheck size={16} />
                  No action needed. Eve is watching for a useful signal.
                </div>
              )}
            </section>
            <section className="account-section">
              <SectionTitle
                title="How we got here"
                action={
                  <button
                    className="text-link"
                    onClick={() => setTab("activity")}
                  >
                    All activity
                    <ArrowRight size={13} />
                  </button>
                }
              />
              <div className="timeline">
                {events.slice(0, 5).map((e) => (
                  <div className="timeline-item" key={e.id}>
                    <span className="timeline-dot">
                      <Activity size={12} />
                    </span>
                    <div>
                      <strong>{titleCase(e.eventName)}</strong>
                      <p>
                        {data.signalDefinitions.find(
                          (s) => s.eventName === e.eventName,
                        )?.description ??
                          "Observed product event. No additional interpretation is assumed."}
                      </p>
                      <span className="mono">{e.eventId}</span>
                    </div>
                    <time>{relativeTime(e.occurredAt, now)}</time>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <aside className="account-aside">
            <div className="detail-panel">
              <SectionTitle title="People & workspace" />
              {contacts.map((c) => (
                <div className="contact-card" key={c.id}>
                  <Avatar
                    initials={c.name
                      .split(" ")
                      .map((x) => x[0])
                      .join("")
                      .slice(0, 2)}
                    color="gray"
                    small
                  />
                  <div>
                    <strong>{c.name}</strong>
                    <p>{c.title}</p>
                    <a href={`mailto:${c.email}`}>{c.email}</a>
                    {c.suppressed && <Badge tone="red">Unsubscribed</Badge>}
                  </div>
                </div>
              ))}
              <div className="detail-properties">
                <div>
                  <span>Account owner</span>
                  <strong>{account.owner}</strong>
                </div>
                <div>
                  <span>Product workspace</span>
                  <code>
                    {data.productWorkspaces.find((p) => p.accountId === id)
                      ?.externalId ?? "Unresolved"}
                  </code>
                </div>
                <div>
                  <span>Identity</span>
                  <Badge tone="green">
                    <Check size={11} />
                    Resolved
                  </Badge>
                </div>
              </div>
            </div>
            <div className="detail-panel">
              <SectionTitle
                title="In the CRM"
                action={<Database size={15} />}
              />
              <div className="crm-state">
                <span className="hubspot-mark">☷</span>
                <div>
                  <strong>HubSpot</strong>
                  <p>
                    {account.crmId
                      ? "Account synced"
                      : "Ready for first writeback"}
                  </p>
                </div>
                <Badge tone={account.crmId ? "green" : "neutral"}>
                  {account.crmId ? "Synced" : "Pending"}
                </Badge>
              </div>
              {data.crmChanges
                .filter((c) => c.accountId === id)
                .map((c) => (
                  <button
                    key={c.id}
                    className="crm-change"
                    onClick={() => setReview(c.actionId)}
                  >
                    <span>
                      {Object.entries(c.fields)
                        .map(([k, v]) => `${k} → ${v}`)
                        .join(", ")}
                    </span>
                    <Badge tone={c.status === "synced" ? "green" : "amber"}>
                      {c.status}
                    </Badge>
                  </button>
                ))}
            </div>
            <div className="detail-panel">
              <SectionTitle
                title="Worth remembering"
                action={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Add account memory"
                    onClick={() => setNoteOpen(true)}
                  >
                    <Plus size={15} />
                  </Button>
                }
              />
              {memories.length ? (
                memories.slice(0, 3).map((m) => (
                  <div className="memory-snippet" key={m.id}>
                    <p>{m.text}</p>
                    <span>
                      {m.kind === "inferred" ? "Inferred" : "Confirmed"} ·{" "}
                      {m.source}
                    </span>
                  </div>
                ))
              ) : (
                <p className="muted">Add a note to give Eve more context.</p>
              )}
            </div>
          </aside>
        </div>
      )}
      {tab === "activity" && (
        <section className="tab-section">
          <SectionTitle
            title="Product activity"
            subtitle="An append-only log of observed behavior. Interpretation is shown separately."
          />
          <div className="timeline">
            {events.map((e) => (
              <div key={e.id} className="timeline-item">
                <span className="timeline-dot">
                  <Activity size={12} />
                </span>
                <div>
                  <strong>{titleCase(e.eventName)}</strong>
                  <p>
                    {data.signalDefinitions.find(
                      (s) => s.eventName === e.eventName,
                    )?.description ?? "Observed event"}
                  </p>
                  <div className="event-meta">
                    <code>{e.eventId}</code>
                    <code>{e.userId}</code>
                  </div>
                  {Object.keys(e.properties).length > 0 && (
                    <pre>{JSON.stringify(e.properties, null, 2)}</pre>
                  )}
                </div>
                <time>{shortDate(e.occurredAt)}</time>
              </div>
            ))}
          </div>
        </section>
      )}
      {tab === "conversation" && (
        <section className="tab-section">
          <SectionTitle
            title="Conversations"
            subtitle="Email and call history, attached to the account."
          />
          {data.conversations
            .filter((c) => c.accountId === id)
            .map((c) => (
              <article
                className={`conversation-card ${c.direction}`}
                key={c.id}
              >
                <div>
                  <Badge tone={c.direction === "inbound" ? "green" : "neutral"}>
                    {titleCase(c.direction)} · {c.channel}
                  </Badge>
                  <time>{shortDate(c.createdAt)}</time>
                </div>
                <h3>
                  {c.subject ??
                    (c.direction === "inbound"
                      ? `${contact?.name ?? "Contact"} replied`
                      : "Conversation")}
                </h3>
                <p>{c.text}</p>
                {c.providerId && <small className="mono">{c.providerId}</small>}
              </article>
            ))}
          {!data.conversations.some((c) => c.accountId === id) && (
            <EmptyState
              icon={<MessageSquare size={24} />}
              title="The conversation starts here"
              description="Approved emails and incoming replies appear together, with their full context."
            />
          )}
        </section>
      )}
      {tab === "artifacts" && (
        <section className="tab-section">
          <SectionTitle
            title="Made for this account"
            subtitle="Every revision has its own evidence, policy, and approval."
            action={
              <Button
                onClick={() => void generate(id).catch(() => {})}
                disabled={busy}
              >
                <Plus size={14} />
                Generate page revision
              </Button>
            }
          />
          <div className="artifacts-grid">
            {pages.map((page) => (
              <div className="artifact-page-card" key={page.id}>
                <div className="artifact-card-top">
                  <span>
                    <Globe size={14} />
                    Personalized page · v{page.revision}
                  </span>
                  <Badge
                    tone={page.status === "published" ? "green" : "neutral"}
                  >
                    {page.status}
                  </Badge>
                </div>
                <div className="artifact-thumbnail">
                  <PageRenderer
                    spec={page.spec}
                    brand={data.brandProfiles.find(
                      (b) => b.version === page.brandVersion,
                    )}
                    compact
                  />
                </div>
                <PageControls pageId={page.id} />
                <div className="artifact-card-bottom">
                  <span>
                    Brand v{page.brandVersion} · Policy v{page.policyVersion}
                  </span>
                  <Button
                    size="small"
                    onClick={() =>
                      setReview(
                        actions.find((a) => a.artifactId === page.artifactId)
                          ?.id ?? null,
                      )
                    }
                  >
                    Review page
                    <ArrowUpRight size={13} />
                  </Button>
                </div>
              </div>
            ))}
            {data.artifacts
              .filter((a) => a.accountId === id && a.kind !== "page")
              .map((a) => (
                <button
                  className="artifact-text-card"
                  key={a.id}
                  onClick={() =>
                    setReview(
                      actions.find((x) => x.artifactId === a.id)?.id ?? null,
                    )
                  }
                >
                  <span className="eyebrow">
                    {a.kind} · REVISION {a.revision}
                  </span>
                  <h3>{a.title}</h3>
                  <p>{a.body}</p>
                  <span className="text-link">
                    Inspect artifact
                    <ArrowUpRight size={13} />
                  </span>
                </button>
              ))}
          </div>
        </section>
      )}
      {tab === "memory" && (
        <section className="tab-section">
          <SectionTitle
            title="Account memory"
            subtitle="Facts, interpretations, and your corrections. Each with a source."
            action={
              <Button onClick={() => setNoteOpen(true)}>
                <Plus size={14} />
                Add memory
              </Button>
            }
          />
          <div className="memory-list">
            {memories.map((m) => (
              <article key={m.id}>
                <div>
                  <Badge tone={m.kind === "inferred" ? "amber" : "green"}>
                    {titleCase(m.kind)}
                  </Badge>
                  <span>{Math.round(m.confidence * 100)}% confidence</span>
                </div>
                <p>{m.text}</p>
                <footer>
                  {m.source} · {shortDate(m.createdAt)}
                </footer>
              </article>
            ))}
          </div>
          <SectionTitle
            title="Approved business sources"
            subtitle="Retrieved context may inform a decision. It cannot grant authority."
          />
          <div className="source-list">
            {data.knowledgeSources.map((s) => (
              <div key={s.id}>
                <FileText size={19} />
                <div>
                  <strong>{s.title}</strong>
                  <p>{s.url ?? s.kind}</p>
                </div>
                <Badge tone="green">
                  {s.kind === "website"
                    ? "Website"
                    : s.kind === "user"
                      ? "You told Eve"
                      : "Imported file"}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
      {tab === "history" && (
        <section className="tab-section">
          <SectionTitle
            title="Every move, explained"
            subtitle="Signals, decisions, approvals, execution checks, and outcomes."
            action={
              <SearchInput
                value={auditQuery}
                onChange={setAuditQuery}
                placeholder="Search account history…"
              />
            }
          />
          <div className="timeline">
            {audit.map((a) => (
              <div className="timeline-item" key={a.id}>
                <span className="timeline-dot">
                  <GitBranch size={12} />
                </span>
                <div>
                  <strong>{a.title}</strong>
                  <p>{a.detail}</p>
                  <span>
                    {a.actor} · Policy v{a.policyVersion}
                  </span>
                  {a.actionId && (
                    <button
                      className="text-link"
                      onClick={() => setReview(a.actionId!)}
                    >
                      Inspect action
                      <ArrowUpRight size={12} />
                    </button>
                  )}
                </div>
                <time>{shortDate(a.createdAt)}</time>
              </div>
            ))}
          </div>
        </section>
      )}
      <ActionReview actionId={review} onClose={() => setReview(null)} />
      <Modal
        open={noteOpen}
        onOpenChange={setNoteOpen}
        title={`A little more context for ${account.name}`}
        description="This note stays scoped to this account. It does not change the playbook."
      >
        <Field label="Account memory">
          <textarea
            className="input"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What should Eve know before the next move?"
          />
        </Field>
        <div className="modal-actions">
          <Button onClick={() => setNoteOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!note.trim()}
            onClick={() =>
              void command({ type: "memory", accountId: id, text: note })
                .then(() => {
                  setNoteOpen(false);
                  setNote("");
                  toast.success("Account memory saved.");
                })
                .catch(() => {})
            }
          >
            Save memory
          </Button>
        </div>
      </Modal>
      <Modal
        open={simulation}
        onOpenChange={setSimulation}
        title="Change the prospect’s story"
        description="Send a deterministic demo signal and watch Eve adapt. No external provider is contacted."
      >
        <div className="simulation-options">
          {[
            [
              "first_api_request_succeeded",
              "First production request",
              "Resolve activation friction and cancel obsolete outreach.",
            ],
            [
              "reply",
              "Prospect replies",
              "Record the reply and stop the planned follow-up.",
            ],
            [
              "pricing_viewed",
              "View pricing",
              "Add commercial-interest evidence.",
            ],
            [
              "teammate_invited",
              "Invite a teammate",
              "Combine with pricing activity after activation.",
            ],
            [
              "upgrade_completed",
              "Upgrade to paid",
              "Record conversion and stop acquisition outreach.",
            ],
            [
              "unsubscribe",
              "Unsubscribe",
              "Suppress contact immediately, including approved actions.",
            ],
          ].map(([type, title, desc]) => (
            <button
              key={type}
              onClick={() => void simulate(type)}
              disabled={busy}
            >
              <Activity size={17} />
              <div>
                <strong>{title}</strong>
                <p>{desc}</p>
              </div>
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
