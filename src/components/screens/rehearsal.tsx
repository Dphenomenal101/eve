"use client";
import Link from "next/link";
import { useState } from "react";
import {
  FlaskConical,
  ArrowRight,
  Check,
  Mail,
  Globe,
  Activity,
  Database,
  RotateCcw,
  ShieldCheck,
  Play,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { useEve } from "../eve-provider";
import { useEveHref } from "../shell";
import { Badge, Button, SectionTitle, Modal, cn } from "../ui";
import { ActionReview } from "../action-review";
import { shortDate } from "@/lib/format";
export function Rehearsal() {
  const { data, demo, event, outcome, now, reset, rehearse, busy } = useEve(),
    href = useEveHref();
  const [review, setReview] = useState<string | null>(null),
    [resetOpen, setResetOpen] = useState(false);
  const account = data.accounts.find((a) => a.id === "acme"),
    email = data.actions.find(
      (a) =>
        a.accountId === "acme" &&
        a.idempotencyKey.endsWith(":activation-email"),
    ),
    page = data.actions.find(
      (a) => a.accountId === "acme" && a.kind === "page",
    ),
    followup = data.actions.find((a) => a.accountId === "acme" && a.followUp),
    crm = data.actions.find((a) => a.accountId === "acme" && a.kind === "crm"),
    activated = data.outcomes.some(
      (o) => o.accountId === "acme" && o.type === "activated",
    );
  const steps = [
    {
      title: "Sarah signs up at Acme",
      description:
        "A work email resolves the person, product workspace, and company.",
      done: !!account,
      icon: Activity,
    },
    {
      title: "A meaningful signal arrives",
      description:
        "Production setup stalls. Eve distinguishes activation friction from buying intent.",
      done: !!email,
      icon: FlaskConical,
    },
    {
      title: "You review the next move",
      description:
        "Inspect the evidence, personalized page, and helpful email. Approve each separately.",
      done: email?.status === "succeeded" && page?.status === "succeeded",
      icon: ShieldCheck,
    },
    {
      title: "Eve sends and follows through",
      description:
        "An email is simulated once, with a follow-up prepared under your authority policy.",
      done: email?.status === "succeeded",
      icon: Mail,
    },
    {
      title: "The prospect’s story changes",
      description:
        "A successful request or reply cancels the obsolete follow-up.",
      done: !!followup && followup.status === "cancelled",
      icon: Activity,
    },
    {
      title: "The CRM catches up",
      description:
        "Approve the final lifecycle writeback and inspect the full audit trail.",
      done: crm?.status === "succeeded",
      icon: Database,
    },
  ];
  async function activate() {
    try {
      await event({
        eventId: "rehearsal-acme-activation",
        workspaceId: data.workspace.id,
        eventName: "first_api_request_succeeded",
        occurredAt: now,
        userId: "user-acme",
        userEmail: "sarah@acme.example",
        companyDomain: "acme.example",
        productWorkspaceId: "product-acme",
        properties: {},
      });
      toast.success(
        "Acme activated. Obsolete outreach cancelled; CRM update prepared.",
      );
    } catch {}
  }
  return (
    <div className="page rehearsal-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">A SMALL REHEARSAL. A COMPLETE LOOP.</div>
          <h1>See what thoughtful looks like.</h1>
          <p>
            Walk a prospect from first signal to a useful outcome. Every move is
            inspectable.
          </p>
        </div>
        <Badge tone="green">
          <FlaskConical size={12} />
          {demo ? "Simulated tools only" : "Observe-mode rehearsal"}
        </Badge>
      </div>
      {!demo ? (
        <div className="rehearsal-hero">
          <span className="eve-symbol">e</span>
          <h2>Rehearse before you activate.</h2>
          <p>
            Create a synthetic prospect in Observe mode. Test actions stay as
            drafts and cannot invoke providers.
          </p>
          <Button
            variant="primary"
            loading={busy}
            onClick={() =>
              void rehearse()
                .then(() =>
                  toast.success(
                    "Test prospect received. Open Accounts to inspect the draft actions.",
                  ),
                )
                .catch(() => {})
            }
          >
            Run test prospect
            <ArrowRight size={15} />
          </Button>
          <Link className="text-link" href={href("/accounts")}>
            Inspect test prospect
            <ArrowUpRight size={13} />
          </Link>
        </div>
      ) : (
        <div className="rehearsal-grid">
          <section className="rehearsal-steps">
            {steps.map((step, i) => (
              <div
                key={step.title}
                className={cn("rehearsal-step", step.done && "complete")}
              >
                <div className="rehearsal-number">
                  {step.done ? (
                    <Check size={16} />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </div>
                <div>
                  <span className="eyebrow">STEP {i + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  {i === 2 && (
                    <div className="step-buttons">
                      <Button
                        size="small"
                        onClick={() => setReview(page?.id ?? null)}
                      >
                        <Globe size={13} />
                        {page?.status === "succeeded"
                          ? "Inspect page"
                          : "Review page"}
                      </Button>
                      <Button
                        size="small"
                        variant="primary"
                        onClick={() => setReview(email?.id ?? null)}
                      >
                        <Mail size={13} />
                        {email?.status === "succeeded"
                          ? "Inspect email"
                          : "Review email"}
                      </Button>
                    </div>
                  )}
                  {i === 4 && (
                    <div className="step-buttons">
                      <Button
                        size="small"
                        disabled={email?.status !== "succeeded" || activated}
                        onClick={() => void activate()}
                      >
                        <Activity size={13} />
                        {activated
                          ? "Activation received"
                          : "Simulate first request"}
                      </Button>
                      <Button
                        size="small"
                        disabled={email?.status !== "succeeded"}
                        onClick={() =>
                          void outcome(
                            "acme",
                            "reply",
                            "Thanks! The quickstart worked. We’ve made our first request.",
                          )
                            .then(() =>
                              toast.success(
                                "Reply recorded; stale follow-ups cancelled.",
                              ),
                            )
                            .catch(() => {})
                        }
                      >
                        Simulate a reply
                      </Button>
                    </div>
                  )}
                  {i === 5 && crm && (
                    <div className="step-buttons">
                      <Button
                        size="small"
                        variant="primary"
                        onClick={() => setReview(crm.id)}
                      >
                        Review CRM update
                        <ArrowRight size={13} />
                      </Button>
                    </div>
                  )}
                </div>
                <step.icon size={18} />
              </div>
            ))}
          </section>
          <aside>
            <div className="rehearsal-summary">
              <span className="eve-symbol">e</span>
              <h2>
                A helpful first impression.
                <br />A better next step.
              </h2>
              <p>
                Sarah’s team needs to get an integration working. Eve leads with
                useful technical help and waits for evidence before selling.
              </p>
              <div className="rehearsal-progress">
                <span>
                  {steps.filter((s) => s.done).length} of {steps.length} steps
                  complete
                </span>
                <div>
                  <i
                    style={{
                      width: `${(steps.filter((s) => s.done).length / steps.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <Link href={href("/accounts/acme")} className="btn btn-secondary">
                Open Acme’s workspace
                <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="settings-card">
              <SectionTitle title="What this proves" />
              <ul className="safeguard-list">
                {[
                  "Signals become account context",
                  "Evidence informs the next move",
                  "Approval is explicit and scoped",
                  "Replay does not duplicate actions",
                  "New outcomes cancel obsolete work",
                  "CRM reflects the final result",
                ].map((x) => (
                  <li key={x}>
                    <Check size={13} />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <button className="text-link" onClick={() => setResetOpen(true)}>
              <RotateCcw size={12} />
              Start the rehearsal again
            </button>
          </aside>
        </div>
      )}
      <ActionReview actionId={review} onClose={() => setReview(null)} />
      <Modal
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset this rehearsal?"
        description="All demo changes return to the canonical starting point."
      >
        <div className="modal-actions">
          <Button onClick={() => setResetOpen(false)}>Keep going</Button>
          <Button
            variant="primary"
            onClick={() => {
              reset();
              setResetOpen(false);
            }}
          >
            Reset demo
          </Button>
        </div>
      </Modal>
    </div>
  );
}
