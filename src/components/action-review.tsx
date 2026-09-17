"use client";
import { useState } from "react";
import {
  Mail,
  Globe,
  Phone,
  Database,
  Check,
  ShieldCheck,
  Clock,
  ArrowUpRight,
  Pencil,
  X,
  FileText,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useEve } from "./eve-provider";
import { Badge, Button, Modal, Field, Input } from "./ui";
import { PageRenderer } from "./page-renderer";
import {
  currentPolicy,
  preflight,
  writingGate,
  activeStatuses,
} from "@/domain/engine";
import { shortDate, titleCase, statusTone } from "@/lib/format";
import type { Action } from "@/domain/schema";
export const actionIcons = {
  email: Mail,
  page: Globe,
  call: Phone,
  crm: Database,
};
export function ActionReview({
  actionId,
  onClose,
}: {
  actionId: string | null;
  onClose: () => void;
}) {
  const { data, command, now, busy, role, demo } = useEve();
  const [editing, setEditing] = useState(false),
    [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [intent, setIntent] = useState<"reject" | "cancel" | "schedule" | null>(
      null,
    ),
    [reason, setReason] = useState(""),
    [time, setTime] = useState("");
  const action = data.actions.find((a) => a.id === actionId);
  if (!action) return null;
  const artifact = data.artifacts.find((x) => x.id === action.artifactId)!,
    account = data.accounts.find((a) => a.id === action.accountId)!,
    contact = data.contacts.find((c) => c.id === action.contactId),
    page = data.pageSpecs.find((p) => p.artifactId === artifact.id),
    Icon = actionIcons[action.kind];
  const issues = action.kind === "email" ? writingGate(data, artifact) : [];
  const canAct = role !== "viewer" && activeStatuses.has(action.status);
  const disabled =
    busy ||
    (currentPolicy(data).overrides[action.kind] ?? currentPolicy(data).mode) ===
      "observe" ||
    issues.length > 0;
  const execute = async (fn: () => Promise<void>, message: string) => {
    try {
      await fn();
      toast.success(message);
      setIntent(null);
      setEditing(false);
    } catch {}
  };
  return (
    <>
      <Modal
        open={!!actionId}
        onOpenChange={(v) => {
          if (!v) {
            onClose();
            setEditing(false);
          }
        }}
        title={
          action.kind === "page"
            ? "A more relevant first impression"
            : action.kind === "email"
              ? "A thoughtful next touch"
              : action.title
        }
        description={`${account.name} · ${demo ? "Simulated " : ""}${action.kind} · Policy v${action.policyVersion}`}
        wide
      >
        <div className="review-meta">
          <Badge tone={statusTone(action.status)} dot>
            {titleCase(action.status)}
          </Badge>
          <span>
            <Icon size={14} />
            {action.kind === "email"
              ? contact?.email
              : action.kind === "page"
                ? `/p/${page?.slug}`
                : account.name}
          </span>
          <span className="push-right">Revision {artifact.revision}</span>
        </div>
        <div className="review-content">
          {editing ? (
            <div className="edit-form">
              <Field label="Subject">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>
              <Field label="Message">
                <textarea
                  className="input"
                  rows={12}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </Field>
              <Button
                variant="primary"
                onClick={() =>
                  void execute(
                    () =>
                      command({
                        type: "edit",
                        actionId: action.id,
                        title,
                        body,
                      }),
                    "A new revision is ready for review.",
                  )
                }
              >
                Save revision
              </Button>
            </div>
          ) : page ? (
            <PageRenderer
              spec={page.spec}
              brand={data.brandProfiles.find(
                (b) => b.version === page.brandVersion,
              )}
              compact
            />
          ) : (
            <div className="email-preview">
              <div className="email-header">
                <span>FROM</span>
                <strong>{data.businessProfiles[0].name} team</strong>
                <span>{action.kind === "email" ? "SUBJECT" : "ACTION"}</span>
                <strong>{artifact.title}</strong>
              </div>
              <p>{artifact.body}</p>
            </div>
          )}
          <div className="decision-note">
            <div className="decision-label">
              <span className="eve-symbol small">e</span>
              <strong>Why this, why now</strong>
              <Badge tone="green">Evidence backed</Badge>
            </div>
            <p>{action.rationale}</p>
            <div className="evidence-tags">
              {action.evidenceIds.slice(-3).map((id) => {
                const event = data.productEvents.find((e) => e.id === id);
                return event ? (
                  <span key={id}>
                    <Check size={12} />
                    {event.eventName.replaceAll("_", " ")}
                  </span>
                ) : null;
              })}
            </div>
          </div>
          <div className="review-gate">
            <ShieldCheck size={17} />
            <div>
              <strong>
                {issues.length
                  ? "Writing check needs attention"
                  : "Execution safeguards are on"}
              </strong>
              <p>
                {issues.length
                  ? issues.join(" ")
                  : "Approval is checked again against current account state, quiet hours, frequency caps, and suppression before execution."}
              </p>
            </div>
          </div>
          {action.error && (
            <div className="inline-alert">
              <AlertCircle size={16} />
              {action.error}
            </div>
          )}
          {action.cancellationReason && (
            <div className="inline-alert">{action.cancellationReason}</div>
          )}
        </div>
        <div className="review-footer">
          <span>
            {demo
              ? "No live messages or provider writes."
              : "Execution is recorded in the account history."}
          </span>
          <div>
            {canAct && (
              <>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => {
                    setIntent("reject");
                    setReason("");
                  }}
                >
                  Reject
                </Button>
                {!["page", "crm"].includes(action.kind) && (
                  <Button
                    size="small"
                    onClick={() => {
                      setEditing(true);
                      setTitle(artifact.title);
                      setBody(artifact.body);
                    }}
                  >
                    <Pencil size={13} />
                    Edit
                  </Button>
                )}
                <Button
                  size="small"
                  onClick={() => {
                    setIntent("schedule");
                    setTime(
                      new Date(now + 86400000).toISOString().slice(0, 16),
                    );
                  }}
                >
                  <Clock size={13} />
                  Schedule
                </Button>
                {action.status !== "scheduled" && (
                  <Button
                    variant="primary"
                    disabled={disabled}
                    size="small"
                    onClick={() =>
                      void execute(
                        () => command({ type: "approve", actionId: action.id }),
                        demo
                          ? "Approved. The simulated action has been processed."
                          : "Approved. Eve will run the final checks before executing.",
                      )
                    }
                  >
                    <Check size={14} />
                    {action.kind === "email"
                      ? "Approve & send"
                      : action.kind === "page"
                        ? "Approve & publish"
                        : "Approve action"}
                  </Button>
                )}
                {action.status === "scheduled" && (
                  <Button
                    size="small"
                    variant="danger"
                    onClick={() => {
                      setIntent("cancel");
                      setReason("");
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </>
            )}
            {!canAct && <Button onClick={onClose}>Done</Button>}
          </div>
        </div>
      </Modal>
      <Modal
        open={intent !== null}
        onOpenChange={(v) => {
          if (!v) setIntent(null);
        }}
        title={
          intent === "schedule"
            ? "Choose a better moment"
            : intent === "reject"
              ? "Reject this recommendation?"
              : "Cancel this action?"
        }
        description={
          intent === "schedule"
            ? "Times are in UTC. Approval and preflight still apply."
            : "Eve keeps your decision and reason in the account history."
        }
      >
        {intent === "schedule" ? (
          <Field label="Scheduled time (UTC)">
            <Input
              type="datetime-local"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>
        ) : (
          <Field label="Reason">
            <textarea
              className="input"
              rows={3}
              placeholder="What should Eve know?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        )}
        <div className="modal-actions">
          <Button onClick={() => setIntent(null)}>Go back</Button>
          <Button
            variant={intent === "schedule" ? "primary" : "danger"}
            disabled={intent !== "schedule" && !reason.trim()}
            onClick={() =>
              void execute(
                () =>
                  command(
                    intent === "schedule"
                      ? {
                          type: "schedule",
                          actionId: action.id,
                          scheduledAt: new Date(`${time}Z`).getTime(),
                        }
                      : {
                          type: intent as "reject" | "cancel",
                          actionId: action.id,
                          reason,
                        },
                  ),
                intent === "schedule"
                  ? "Action rescheduled."
                  : "Decision recorded.",
              )
            }
          >
            {intent === "schedule"
              ? "Save schedule"
              : intent === "reject"
                ? "Reject action"
                : "Cancel action"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
