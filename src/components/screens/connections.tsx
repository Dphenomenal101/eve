"use client";
import { useState } from "react";
import {
  Plug,
  Activity,
  Mail,
  Phone,
  Database,
  Globe,
  KeyRound,
  ShieldCheck,
  ArrowUpRight,
  Check,
  Copy,
  Code2,
  RefreshCw,
  Unplug,
  ChevronRight,
  FlaskConical,
  Lock,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { useEve } from "../eve-provider";
import { Badge, Button, Field, Input, Modal, SectionTitle } from "../ui";
import { relativeTime, titleCase, statusTone } from "@/lib/format";
import { setupPrompt } from "@/domain/instrumentation";
import type { Connection } from "@/domain/schema";
const icons = {
  events: Activity,
  agentmail: Mail,
  retell: Phone,
  context: Globe,
  hubspot: Database,
  model: KeyRound,
};
export function Connections() {
  const { data, demo, now, command, connect, verifyCrm, busy, role } = useEve();
  const [selected, setSelected] = useState<Connection | null>(null),
    [disconnect, setDisconnect] = useState<Connection | null>(null),
    [promptOpen, setPromptOpen] = useState(false),
    [ingestKey, setIngestKey] = useState("");
  const readOnly = !["owner", "admin"].includes(role);
  const ingestUrl = `${process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "https://YOUR_DEPLOYMENT.convex.site"}/events`;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      fields = new FormData(form);
    const secret = String(fields.get("secret") ?? ""),
      resourceId = String(fields.get("resourceId") ?? "");
    const webhookSecret = String(fields.get("webhookSecret") ?? "");
    form.reset();
    try {
      const result = (await connect(
        selected!.provider,
        secret,
        resourceId,
        webhookSecret,
      )) as { redirectUrl?: string; ingestKey?: string } | undefined;
      if (result?.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      if (result?.ingestKey) {
        setIngestKey(result.ingestKey);
        return;
      }
      setSelected(null);
      toast.success("Connection verified and saved.");
    } catch {}
  }
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR TOOLS. WORKING TOGETHER.</div>
          <h1>Connected, with context.</h1>
          <p>
            Customer-owned accounts. Clear permissions. A useful view of their
            health.
          </p>
        </div>
        <Badge tone="green">
          <ShieldCheck size={12} />
          {data.connections.filter((c) => c.status === "healthy").length}{" "}
          healthy connections
        </Badge>
      </div>
      <div className="connection-callout">
        <Lock size={18} />
        <div>
          <strong>
            {demo
              ? "Everything here is safely simulated."
              : "Your accounts stay yours."}
          </strong>
          <p>
            {demo
              ? "Demo mode never reads credentials, calls providers, or writes to a live workspace."
              : "Credentials are verified on the server and encrypted before storage. Eve never reveals a saved key or includes it in model context."}
          </p>
        </div>
      </div>
      {!demo &&
        data.connections.some(
          (c) => c.provider === "hubspot" && c.status === "pending",
        ) && (
          <div className="connection-callout">
            <Database size={18} />
            <div>
              <strong>Finish connecting HubSpot</strong>
              <p>
                After authorizing your account, verify its ownership and field
                mapping here.
              </p>
              <Button
                loading={busy}
                disabled={readOnly}
                onClick={() =>
                  void verifyCrm(
                    new URLSearchParams(window.location.search).get(
                      "session_uri",
                    ) ?? undefined,
                  )
                    .then(() => {
                      window.history.replaceState(
                        null,
                        "",
                        "/connections?demo=0",
                      );
                      toast.success("HubSpot connection verified.");
                    })
                    .catch(() => {})
                }
              >
                Verify CRM connection
              </Button>
            </div>
          </div>
        )}
      <div className="connections-grid">
        {data.connections.map((c) => {
          const Icon = icons[c.provider];
          return (
            <article key={c.id} className="connection-card">
              <div className="connection-card-heading">
                <span className={`provider-icon provider-${c.provider}`}>
                  <Icon size={23} />
                </span>
                <Badge tone={statusTone(c.status)} dot>
                  {titleCase(c.status)}
                </Badge>
              </div>
              <h2>{c.name}</h2>
              <p>{c.description}</p>
              <div className="connection-capabilities">
                {c.capabilities.map((x) => (
                  <span key={x}>
                    <Check size={11} />
                    {x}
                  </span>
                ))}
              </div>
              <div className="connection-metadata">
                <div>
                  <span>Account owner</span>
                  <strong>
                    {c.scope === "simulated" ? "Demo account" : c.owner}
                  </strong>
                </div>
                <div>
                  <span>Credential scope</span>
                  <strong>{titleCase(c.scope)}</strong>
                </div>
                {c.lastSuccessAt && (
                  <div>
                    <span>Last successful operation</span>
                    <strong>{relativeTime(c.lastSuccessAt, now)}</strong>
                  </div>
                )}
                {c.mapping?.pipelineLabel && (
                  <div>
                    <span>Opportunity mapping</span>
                    <strong>
                      {c.mapping.pipelineLabel} / {c.mapping.stageLabel}
                    </strong>
                  </div>
                )}
                {c.resourceId && (
                  <div>
                    <span>Selected resource</span>
                    <code>{c.resourceId}</code>
                  </div>
                )}
                {c.lastError && (
                  <div className="connection-error">{c.lastError}</div>
                )}
              </div>
              <div className="connection-card-footer">
                <Button
                  size="small"
                  disabled={readOnly}
                  onClick={() => {
                    setSelected(c);
                    setIngestKey("");
                  }}
                >
                  {c.status === "healthy" ? (
                    <>
                      <SettingsIcon />
                      Manage connection
                    </>
                  ) : (
                    <>
                      <Plug size={13} />
                      Connect {c.name}
                    </>
                  )}
                </Button>
                {c.status === "healthy" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={readOnly}
                    aria-label={`Disconnect ${c.name}`}
                    onClick={() => setDisconnect(c)}
                  >
                    <Unplug size={14} />
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <section className="settings-card signal-install">
        <div>
          <Code2 size={24} />
          <div>
            <h2>Tell Eve what’s happening in your product.</h2>
            <p>
              A setup prompt built from your confirmed signals, identity fields,
              and goal.
            </p>
          </div>
        </div>
        <Button onClick={() => setPromptOpen(true)}>
          Get instrumentation prompt
          <ArrowUpRight size={14} />
        </Button>
      </section>
      <Modal
        open={selected !== null}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
        title={selected ? `${selected.name} connection` : "Connect"}
        description={
          demo
            ? "This connection belongs to the isolated demo workspace."
            : "Choose resources inside your own provider account. A saved secret is never shown again."
        }
      >
        {selected && demo ? (
          <div className="demo-connection-details">
            <FlaskConical size={30} />
            <h3>{selected.name} is simulated.</h3>
            <p>
              You can inspect capabilities and advance the rehearsal without
              entering a key. Use your live workspace when you’re ready to
              connect real accounts.
            </p>
            <dl>
              <dt>Owner</dt>
              <dd>{selected.owner}</dd>
              <dt>Capabilities</dt>
              <dd>{selected.capabilities.join(", ")}</dd>
            </dl>
            <Button onClick={() => setSelected(null)} variant="primary">
              Got it
            </Button>
          </div>
        ) : (
          selected && (
            <form onSubmit={(e) => void submit(e)}>
              {ingestKey ? (
                <div className="secret-once">
                  <Badge tone="amber">Shown only once</Badge>
                  <p>
                    Save this ingestion key in your application’s EVE_INGEST_KEY
                    environment variable.
                  </p>
                  <code>{ingestKey}</code>
                  <Button
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(ingestKey)
                        .then(() => toast.success("Ingestion key copied."))
                    }
                  >
                    <Copy size={14} />
                    Copy key
                  </Button>
                  <p>
                    Endpoint: <code>{ingestUrl}</code>
                  </p>
                </div>
              ) : selected.provider === "events" ? (
                <>
                  <p className="muted">
                    Create a workspace-scoped ingestion key. Only its hash is
                    stored. Rotating the key immediately invalidates the
                    previous key.
                  </p>
                  <div className="modal-actions">
                    <Button variant="primary" type="submit" loading={busy}>
                      Generate ingestion key
                    </Button>
                  </div>
                </>
              ) : selected.provider === "hubspot" ? (
                <>
                  <p className="muted">
                    Authorize your HubSpot account through Composio. After
                    returning, verify the connection before approving a test CRM
                    write.
                  </p>
                  <div className="mapping-preview">
                    <strong>V1 field mapping</strong>
                    <span>Company → domain</span>
                    <span>Contact → email</span>
                    <span>Lifecycle → lifecyclestage</span>
                  </div>
                  <div className="modal-actions">
                    <Button
                      type="submit"
                      name="connect"
                      variant="primary"
                      loading={busy}
                    >
                      Authorize with Composio
                      <ArrowUpRight size={14} />
                    </Button>
                  </div>
                </>
              ) : selected.provider === "model" ? (
                <>
                  <p className="muted">
                    Set AI_GATEWAY_API_KEY and EVE_MODEL on your Convex
                    deployment. The model account belongs to the deployer and is
                    never shared with another tenant’s customer tools.
                  </p>
                  <div className="modal-actions">
                    <Button type="submit" variant="primary" loading={busy}>
                      Verify deployment model
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Field
                    label="Provider API key"
                    hint="Submitted directly to a server action, then cleared from this form."
                  >
                    <Input
                      name="secret"
                      type="password"
                      required
                      autoComplete="off"
                      placeholder="Paste your provider key"
                    />
                  </Field>
                  {selected.provider === "agentmail" && (
                    <>
                      <Field
                        label="AgentMail webhook signing secret"
                        hint={`Configure message.received, message.bounced and message.complained at ${process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "https://YOUR_DEPLOYMENT.convex.site"}/webhooks/agentmail/${data.workspace.id}`}
                      >
                        <Input
                          name="webhookSecret"
                          type="password"
                          autoComplete="off"
                          required
                          placeholder="whsec_…"
                        />
                      </Field>
                      <Field
                        label="Existing inbox ID"
                        hint="Select an inbox you own. Eve will not create a provider resource automatically."
                      >
                        <Input
                          name="resourceId"
                          required
                          placeholder="hello@yourcompany.com"
                        />
                      </Field>
                    </>
                  )}
                  {selected.provider === "retell" && (
                    <Field
                      label="Retell agent ID | owned calling number"
                      hint="Separate your approved agent ID and E.164 phone number with |."
                    >
                      <Input
                        name="resourceId"
                        required
                        placeholder="agent_…|+14155550100"
                      />
                    </Field>
                  )}
                  <div className="modal-actions">
                    <Button onClick={() => setSelected(null)}>Cancel</Button>
                    <Button type="submit" variant="primary" loading={busy}>
                      Verify & save connection
                    </Button>
                  </div>
                </>
              )}
            </form>
          )
        )}
      </Modal>
      <Modal
        open={disconnect !== null}
        onOpenChange={(v) => {
          if (!v) setDisconnect(null);
        }}
        title={`Disconnect ${disconnect?.name}?`}
        description="Eve removes its usable credential and cancels dependent planned actions. You can also revoke the key at your provider."
      >
        <div className="modal-actions">
          <Button onClick={() => setDisconnect(null)}>Keep connection</Button>
          <Button
            variant="danger"
            onClick={() =>
              void command({ type: "disconnect", connectionId: disconnect!.id })
                .then(() => {
                  setDisconnect(null);
                  toast.success("Disconnected. Dependent actions cancelled.");
                })
                .catch(() => {})
            }
          >
            Disconnect
          </Button>
        </div>
      </Modal>
      <Modal
        open={promptOpen}
        onOpenChange={setPromptOpen}
        title="Connect the signals that matter"
        wide
      >
        <div className="prompt-content">
          <pre>{setupPrompt(data, ingestUrl)}</pre>
        </div>
        <div className="review-footer">
          <span>No keys or private business documents included.</span>
          <Button
            variant="primary"
            onClick={() =>
              void navigator.clipboard
                .writeText(setupPrompt(data, ingestUrl))
                .then(() => toast.success("Setup prompt copied."))
            }
          >
            <Copy size={14} />
            Copy prompt
          </Button>
        </div>
      </Modal>
    </div>
  );
}
function SettingsIcon() {
  return <RefreshCw size={13} />;
}
