"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Activity,
  Check,
  CheckCheck,
  Clock,
  Globe,
  Mail,
  ShieldCheck,
  Leaf,
  ChevronRight,
  Building2,
  Zap,
  Database,
  FlaskConical,
  CornerDownRight,
  Radio,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { useEve } from "../eve-provider";
import { useEveHref } from "../shell";
import { Avatar, Badge, Button, SectionTitle, EmptyState } from "../ui";
import { AccountsTable } from "../accounts-table";
import { ActionReview, actionIcons } from "../action-review";
import { relativeTime, shortDate, titleCase } from "@/lib/format";
export function Overview() {
  const { data, now, demo } = useEve(),
    href = useEveHref();
  const [review, setReview] = useState<string | null>(null);
  const pending = data.actions.filter((a) => a.status === "pending_approval");
  const scheduled = data.actions.filter((a) => a.status === "scheduled");
  const activity = [...data.auditEntries].sort(
    (a, b) => b.createdAt - a.createdAt,
  );
  const chart = Array.from({ length: 14 }, (_, i) => {
    const start = now - (13 - i) * 86400000;
    return {
      day: new Date(start).toLocaleDateString("en", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      value: data.productEvents.filter(
        (e) => e.occurredAt >= start - 86400000 && e.occurredAt < start,
      ).length,
    };
  });
  const metrics = [
    {
      label: "Accounts in view",
      value: data.accounts.length,
      sub: `${data.accounts.filter((a) => a.fit === "high").length} match your ideal customer`,
      icon: Building2,
    },
    {
      label: "Ready for your review",
      value: pending.length,
      sub: "A thoughtful next move awaits",
      icon: Mail,
    },
    {
      label: "Positive outcomes",
      value: data.outcomes.filter((o) => o.type !== "unsubscribe").length,
      sub: "Replies, activations & upgrades",
      icon: Zap,
    },
    {
      label: "CRM updates completed",
      value: data.crmChanges.filter((c) => c.status === "synced").length,
      sub: "Less admin. More context.",
      icon: Database,
    },
  ];
  return (
    <div className="page overview-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow greeting">
            YOUR REVENUE TEAM, ONE STEP AHEAD
          </div>
          <h1>
            Good morning,{" "}
            {data.workspaceMembers[0]?.name.split(" ")[0] ?? "there"}
            <span className="greeting-dot">.</span>
          </h1>
          <p>Here’s what’s moving, what needs you, and what happened next.</p>
        </div>
        <div className="page-heading-actions">
          <span className="date-label">
            {new Date(now).toLocaleDateString("en", {
              weekday: "short",
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })}
          </span>
          <Link
            className="btn btn-secondary btn-small"
            href={href("/rehearsal")}
          >
            <FlaskConical size={14} />
            Run a rehearsal
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
      <div className="metrics-grid">
        {metrics.map((m, i) => (
          <div className="metric" key={m.label}>
            <div className="metric-label">
              {m.label}
              <m.icon size={15} />
            </div>
            <div className="metric-value">
              {m.value}
              <span className={`metric-mini metric-mini-${i}`}>
                {i === 0 ? (
                  <Activity size={19} />
                ) : i === 1 ? (
                  <span className="mini-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                ) : i === 2 ? (
                  <CheckCheck size={23} />
                ) : (
                  <ShieldCheck size={21} />
                )}
              </span>
            </div>
            <p>
              <span className={i === 1 ? "amber-dot" : "metric-bullet"} />
              {m.sub}
            </p>
          </div>
        ))}
      </div>
      <div className="overview-columns">
        <div className="overview-primary">
          <section className="attention-section">
            <SectionTitle
              title="A little input from you"
              count={pending.length}
              subtitle="Eve did the groundwork. You make the call."
              action={
                <Link
                  className="text-link"
                  href={href("/accounts?filter=needs_attention")}
                >
                  View accounts
                  <ArrowRight size={14} />
                </Link>
              }
            />
            <div className="attention-list">
              {pending.length ? (
                pending.slice(0, 4).map((a, i) => {
                  const account = data.accounts.find(
                      (x) => x.id === a.accountId,
                    )!,
                    Icon = actionIcons[a.kind];
                  return (
                    <article
                      key={a.id}
                      className={`attention-card ${i === 0 ? "attention-featured" : ""}`}
                    >
                      <div className="attention-top">
                        <Avatar
                          initials={account.initials}
                          color={account.color}
                          small
                        />
                        <strong>{account.name}</strong>
                        <span className="attention-separator">·</span>
                        <span>
                          {data.contacts.find((c) => c.id === a.contactId)
                            ?.name ?? "Account update"}
                        </span>
                        <Badge tone="amber" dot>
                          Needs approval
                        </Badge>
                      </div>
                      <div className="attention-main">
                        <div className="attention-copy">
                          <h3>
                            {a.kind === "page"
                              ? "A clearer path to their first request"
                              : a.kind === "email" &&
                                  account.stage === "evaluating"
                                ? "A little help at the right moment"
                                : a.kind === "email"
                                  ? "Turn team momentum into a conversation"
                                  : a.title}
                          </h3>
                          <p>{a.rationale}</p>
                          <div className="attention-tags">
                            <span>
                              <Icon size={12} />
                              {a.kind === "page"
                                ? "Personalized page"
                                : a.kind === "email"
                                  ? "Email draft"
                                  : titleCase(a.kind)}
                            </span>
                            <span>
                              <ShieldCheck size={12} />
                              Policy checked
                            </span>
                            <span>{relativeTime(a.createdAt, now)}</span>
                          </div>
                        </div>
                        <Button
                          size="small"
                          variant={i === 0 ? "primary" : "secondary"}
                          onClick={() => setReview(a.id)}
                        >
                          Review{" "}
                          {a.kind === "page"
                            ? "page"
                            : a.kind === "email"
                              ? "draft"
                              : "action"}
                          <ArrowRight size={14} />
                        </Button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="all-clear">
                  <span>
                    <CheckCheck size={24} />
                  </span>
                  <h3>All caught up.</h3>
                  <p>Eve will bring the next useful move here.</p>
                </div>
              )}
            </div>
          </section>
          <section className="scheduled-section">
            <SectionTitle title="Lined up next" count={scheduled.length} />
            {scheduled.length ? (
              <div className="scheduled-list">
                {scheduled.map((a) => {
                  const account = data.accounts.find(
                    (x) => x.id === a.accountId,
                  )!;
                  return (
                    <button
                      key={a.id}
                      className="scheduled-row"
                      onClick={() => setReview(a.id)}
                    >
                      <span className="schedule-icon">
                        <Clock size={17} />
                      </span>
                      <div>
                        <strong>{a.title}</strong>
                        <span>
                          {account.name} <span>·</span>{" "}
                          {shortDate(a.scheduledAt ?? now)} UTC
                        </span>
                      </div>
                      <span className="scheduled-guard">
                        <ShieldCheck size={12} />
                        Rechecks before sending
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="quiet-row">
                <Check size={15} />
                No actions scheduled. Eve is watching for the right moment.
              </div>
            )}
          </section>
        </div>
        <aside className="overview-aside">
          <div className="working-card">
            <div className="working-heading">
              <span className="eve-symbol">e</span>
              <h2>Eve’s working on it</h2>
              <span className="live-dot" />
            </div>
            <p className="working-intro">
              The small moves that keep things moving.
            </p>
            <div className="working-items">
              {data.agentRuns
                .filter((r) => r.status !== "completed")
                .map((r) => {
                  const a = data.accounts.find((a) => a.id === r.accountId)!;
                  return (
                    <Link
                      href={href(`/accounts/${a.id}`)}
                      className="working-item"
                      key={r.id}
                    >
                      <span className={`working-state ${r.status}`}>
                        <span />
                      </span>
                      <div>
                        <strong>{a.name}</strong>
                        <p>{r.summary}</p>
                      </div>
                      <ArrowUpRight size={13} />
                    </Link>
                  );
                })}
              {!data.agentRuns.length && (
                <p className="muted">Ready for your first product signal.</p>
              )}
            </div>
            <div className="working-footer">
              <ShieldCheck size={13} />
              Within your playbook. Always.
            </div>
          </div>
          <div className="activity-section">
            <SectionTitle
              title="Good things happened"
              action={<Badge>Today</Badge>}
            />
            <div className="activity-feed">
              {data.outcomes
                .slice()
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, 4)
                .map((o) => (
                  <Link
                    href={href(`/accounts/${o.accountId}?tab=history`)}
                    className="activity-item"
                    key={o.id}
                  >
                    <span className="activity-icon">
                      <Check size={13} />
                    </span>
                    <div>
                      <strong>
                        {data.accounts.find((a) => a.id === o.accountId)?.name}
                      </strong>
                      <p>{o.label}</p>
                      <time>{relativeTime(o.createdAt, now)}</time>
                    </div>
                  </Link>
                ))}
              {!data.outcomes.length && (
                <p className="muted">
                  Replies, activations, and conversions will show up here.
                </p>
              )}
            </div>
          </div>
          <div className="signal-health">
            <div>
              <span className="live-dot" />
              <strong>Signals are flowing</strong>
              <Link
                href={href("/connections")}
                aria-label="View connection health"
              >
                <ArrowUpRight size={14} />
              </Link>
            </div>
            <p>
              {data.productEvents.length} signals received ·{" "}
              {data.connections.filter((c) => c.status === "healthy").length}{" "}
              healthy connections
            </p>
            <div
              className="signal-chart"
              aria-label="Product events over the last 14 days"
            >
              <ResponsiveContainer width="100%" height={42}>
                <AreaChart data={chart}>
                  <defs>
                    <linearGradient id="signalFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#64856b"
                        stopOpacity={0.18}
                      />
                      <stop offset="100%" stopColor="#64856b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#739278"
                    strokeWidth={1.5}
                    fill="url(#signalFill)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </aside>
      </div>
      <section className="account-overview">
        <SectionTitle
          title="People behind the signals"
          subtitle="Real context. A next step that makes sense."
          action={
            <Link className="text-link" href={href("/accounts")}>
              All accounts
              <ArrowRight size={14} />
            </Link>
          }
        />
        <div className="table-card">
          <AccountsTable accounts={data.accounts.slice(0, 5)} compact />
        </div>
        <div className="table-summary">
          <span>
            {
              data.accounts.filter(
                (a) => a.stage !== "customer" && a.fit !== "excluded",
              ).length
            }{" "}
            accounts with room to grow
          </span>
          <span>
            <ShieldCheck size={12} />
            Observed signals and inferences kept separate
          </span>
        </div>
      </section>
      <section className="recent-audit">
        <SectionTitle title="The latest, with context" />
        <div className="audit-strip">
          {activity.slice(0, 3).map((a) => (
            <Link
              href={href(
                a.accountId
                  ? `/accounts/${a.accountId}?tab=history`
                  : "/playbook?tab=authority",
              )}
              key={a.id}
            >
              <span className="audit-marker" />
              <div>
                <strong>{a.title}</strong>
                <p>{a.detail}</p>
                <time>{relativeTime(a.createdAt, now)}</time>
              </div>
              <ArrowUpRight size={14} />
            </Link>
          ))}
        </div>
      </section>
      <ActionReview actionId={review} onClose={() => setReview(null)} />
    </div>
  );
}
