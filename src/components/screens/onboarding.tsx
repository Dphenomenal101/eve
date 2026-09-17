"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Globe,
  BookOpen,
  Plug,
  FlaskConical,
  Play,
  Users,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useEve } from "../eve-provider";
import { useEveHref } from "../shell";
import { authClient } from "@/lib/auth-client";
import { Button, Badge, Input, Field, SectionTitle, cn } from "../ui";
export function Onboarding() {
  const { data, demo, research, command, busy } = useEve(),
    href = useEveHref();
  const [url, setUrl] = useState(data.businessProfiles[0].website),
    [email, setEmail] = useState(""),
    [role, setRole] = useState("operator"),
    [inviting, setInviting] = useState(false);
  const steps = [
    {
      title: "Show Eve your business",
      description:
        "A website, a few consequential questions, and an editable brief.",
      done: data.businessProfiles[0].confirmed,
      icon: Globe,
      url: "/playbook",
    },
    {
      title: "Confirm the playbook",
      description: "Define your ideal customer, signals, voice, and authority.",
      done: data.signalDefinitions.some((s) => s.confirmed),
      icon: BookOpen,
      url: "/playbook?tab=signals",
    },
    {
      title: "Connect your tools",
      description:
        "Customer-owned accounts. Clear capabilities and permissions.",
      done:
        data.connections.some(
          (c) => c.provider === "agentmail" && c.status === "healthy",
        ) &&
        data.connections.some(
          (c) => c.provider === "hubspot" && c.status === "healthy",
        ),
      icon: Plug,
      url: "/connections",
    },
    {
      title: "Rehearse a real scenario",
      description: "A test prospect, a useful action, and a change of plan.",
      done:
        data.auditEntries.some((a) => a.title === "Test prospect received") ||
        (demo && data.outcomes.some((o) => o.accountId === "acme")),
      icon: FlaskConical,
      url: "/rehearsal",
    },
  ];
  return (
    <div className="page onboarding-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">MEET YOUR NEW TEAMMATE</div>
          <h1>A good brief makes a great beginning.</h1>
          <p>Let’s give Eve enough context to make a useful first move.</p>
        </div>
        <Badge tone={data.workspace.active ? "green" : "amber"}>
          {data.workspace.active ? "Workspace active" : "Setup in progress"}
        </Badge>
      </div>
      <div className="settings-grid">
        <div>
          <section className="website-brief">
            <span className="eve-symbol">e</span>
            <h2>Start with your corner of the internet.</h2>
            <p>
              Eve researches the website through your Context.dev connection and
              brings back a brief for you to confirm.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void research(url)
                  .then(() =>
                    toast.success(
                      demo
                        ? "Meridian’s demo brief is ready in Playbook."
                        : "Research is ready. Review and confirm the brief in Playbook.",
                    ),
                  )
                  .catch(() => {});
              }}
            >
              <div>
                <Globe size={17} />
                <input
                  aria-label="Business website"
                  type="url"
                  required
                  placeholder="https://yourcompany.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <Button type="submit" variant="primary" loading={busy}>
                Get to know us
                <ArrowRight size={14} />
              </Button>
            </form>
            <span>
              {demo
                ? "Demo research uses the canonical Meridian fixture."
                : "Connect Context.dev first, or enter your business brief manually."}
            </span>
          </section>
          <section className="setup-checklist">
            {steps.map((s, i) => (
              <Link
                key={s.title}
                href={href(s.url)}
                className={cn("setup-step", s.done && "done")}
              >
                <span className="setup-step-number">
                  {s.done ? <Check size={16} /> : i + 1}
                </span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.description}</p>
                </div>
                <ArrowUpRight size={16} />
              </Link>
            ))}
          </section>
          <div className="activation-card">
            <ShieldCheck size={24} />
            <div>
              <h3>
                {data.workspace.active
                  ? "Eve is ready to work."
                  : "A final check before getting started."}
              </h3>
              <p>
                Keep Copilot on while you learn how Eve interprets your signals.
              </p>
            </div>
            <Button
              variant={data.workspace.active ? "secondary" : "primary"}
              onClick={() =>
                void command({
                  type: "activate",
                  active: !data.workspace.active,
                })
                  .then(() =>
                    toast.success(
                      data.workspace.active
                        ? "Workspace deactivated."
                        : "Eve is active.",
                    ),
                  )
                  .catch(() => {})
              }
            >
              {data.workspace.active ? "Deactivate" : "Activate Eve"}
              <Play size={13} />
            </Button>
          </div>
        </div>
        <aside>
          <section className="settings-note">
            <h3>The finish line is a received test prospect.</h3>
            <p>
              A connection is useful when the whole loop works. Rehearse a
              signal, inspect the evidence, approve the action, then change the
              prospect’s state.
            </p>
            <Link href={href("/rehearsal")} className="text-link">
              Walk through the rehearsal
              <ArrowRight size={14} />
            </Link>
          </section>
          <section className="settings-card">
            <SectionTitle
              title="Better with your team"
              subtitle="Invite an operator, admin, or viewer."
            />
            {data.workspaceMembers.map((m) => (
              <div className="member-row" key={m.id}>
                <span>
                  {m.name}
                  <small>{m.email}</small>
                </span>
                <Badge>{m.role}</Badge>
              </div>
            ))}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (demo) {
                  toast.info(
                    "Demo invitations are simulated. No email will be sent.",
                  );
                  return;
                }
                setInviting(true);
                try {
                  const r = await authClient.organization.inviteMember({
                    email,
                    role: role as "admin" | "member" | "owner",
                    organizationId: data.workspace.organizationId,
                  });
                  if (r.error) throw new Error(r.error.message);
                  toast.success("Invitation sent.");
                  setEmail("");
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Invitation failed.",
                  );
                } finally {
                  setInviting(false);
                }
              }}
            >
              <Field label="Work email">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="teammate@company.com"
                />
              </Field>
              <Field label="Workspace role">
                <select
                  className="input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="operator">
                    Operator · accounts and approvals
                  </option>
                  <option value="admin">
                    Admin · playbook and connections
                  </option>
                  <option value="viewer">Viewer · read-only</option>
                </select>
              </Field>
              <Button type="submit" loading={inviting}>
                <Mail size={14} />
                Send invitation
              </Button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
