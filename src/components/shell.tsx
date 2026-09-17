"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Building2,
  BookOpen,
  Plug,
  ChevronDown,
  ArrowUpRight,
  Pause,
  Play,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowRight,
  RotateCcw,
  FlaskConical,
  Command,
  Search,
  Check,
  ShieldCheck,
  Menu,
  X,
  Plus,
  Send,
  CornerDownLeft,
  Leaf,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { useEve } from "./eve-provider";
import { Avatar, Badge, Button, Modal, SearchInput, cn } from "./ui";
import { currentPolicy } from "@/domain/engine";
import { shortDate } from "@/lib/format";
export function useEveHref() {
  const { demo } = useEve();
  return (path: string) =>
    `${path}${path.includes("?") ? "&" : "?"}demo=${demo ? 1 : 0}`;
}
const nav = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/accounts", label: "Accounts", icon: Building2 },
  { href: "/playbook", label: "Playbook", icon: BookOpen },
  { href: "/connections", label: "Connections", icon: Plug },
];
export function Shell({ children }: { children: ReactNode }) {
  const { data, demo, command, reset, role, busy } = useEve(),
    href = useEveHref(),
    path = usePathname(),
    router = useRouter();
  const [chat, setChat] = useState(false),
    [mobile, setMobile] = useState(false),
    [search, setSearch] = useState(false),
    [q, setQ] = useState(""),
    [resetConfirm, setResetConfirm] = useState(false),
    [mode, setMode] = useState(false);
  const pending = data.actions.filter(
    (a) => a.status === "pending_approval",
  ).length;
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch((x) => !x);
      }
      if (e.key === "Escape") setMobile(false);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);
  const current =
    nav.find((n) => path.startsWith(n.href))?.label ??
    (path.includes("rehearsal") ? "Rehearsal" : "Getting started");
  return (
    <div className="app-shell">
      <aside className={cn("sidebar", mobile && "sidebar-mobile")}>
        <div className="sidebar-brand">
          <Link
            href={href("/overview")}
            className="eve-wordmark"
            aria-label="Eve home"
          >
            eve<span>✳</span>
          </Link>
          <Button
            size="icon"
            variant="ghost"
            className="mobile-only"
            onClick={() => setMobile(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </Button>
          <span className="version-tag">V1</span>
        </div>
        <button
          className="workspace-selector"
          onClick={() => router.push(href("/onboarding"))}
        >
          <span className="workspace-mark">
            m<span>·</span>
          </span>
          <span>
            <strong>{data.workspace.name}</strong>
            <small>{demo ? "Demo workspace" : "Your workspace"}</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <button className="sidebar-search" onClick={() => setSearch(true)}>
          <Search size={15} />
          <span>Find anything</span>
          <kbd>⌘ K</kbd>
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <Link
              key={n.href}
              href={href(n.href)}
              className={cn("nav-item", path.startsWith(n.href) && "active")}
              onClick={() => setMobile(false)}
            >
              <n.icon size={18} strokeWidth={1.65} />
              {n.label}
              {n.href === "/overview" && pending > 0 && (
                <span className="nav-count">{pending}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-separator" />
        <Link
          href={href("/rehearsal")}
          className={cn("nav-item", path === "/rehearsal" && "active")}
        >
          <FlaskConical size={18} strokeWidth={1.65} />
          Rehearsal<span className="tiny-label">TRY IT</span>
        </Link>
        <Link
          href={href("/onboarding")}
          className={cn("nav-item", path === "/onboarding" && "active")}
        >
          <Settings2 size={18} strokeWidth={1.65} />
          Workspace setup
        </Link>
        <div className="sidebar-bottom">
          <div className="operator-status">
            <span
              className={cn("live-dot", data.workspace.paused && "paused")}
            />
            <strong>
              {data.workspace.paused ? "Eve is paused" : "Eve is on it"}
            </strong>
            <button
              aria-label="Change authority mode"
              onClick={() => setMode(true)}
            >
              <Badge tone="neutral">{data.workspace.mode}</Badge>
            </button>
            <p>
              {data.workspace.paused
                ? "Planned actions are on hold."
                : "Thoughtful actions. Clear boundaries."}
            </p>
          </div>
          <button className="user-profile" onClick={() => setMode(true)}>
            <Avatar initials="AM" color="gray" small />
            <span>
              <strong>
                {data.workspaceMembers[0]?.name ?? "Workspace member"}
              </strong>
              <small>{role.charAt(0).toUpperCase() + role.slice(1)}</small>
            </span>
            <ChevronDown size={14} />
          </button>
        </div>
      </aside>
      <div className="app-column">
        <header className="topbar">
          <div className="breadcrumbs">
            <Button
              size="icon"
              variant="ghost"
              className="mobile-only"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </Button>
            <span>{data.workspace.name}</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{current}</strong>
            {path.startsWith("/accounts/") && (
              <>
                <span className="breadcrumb-slash">/</span>
                <span>
                  {
                    data.accounts.find((a) => a.id === path.split("/").at(-1))
                      ?.name
                  }
                </span>
              </>
            )}
          </div>
          <div className="topbar-actions">
            <span className="live-indicator">
              <span
                className={cn("live-dot", data.workspace.paused && "paused")}
              />
              {data.workspace.paused ? "Paused" : "All systems calm"}
            </span>
            <Button
              size="small"
              aria-label={data.workspace.paused ? "Resume Eve" : "Pause Eve"}
              disabled={role === "viewer" || busy}
              onClick={() =>
                void command({
                  type: "pause",
                  paused: !data.workspace.paused,
                }).catch(() => {})
              }
            >
              {data.workspace.paused ? <Play size={13} /> : <Pause size={13} />}
              <span>{data.workspace.paused ? "Resume Eve" : "Pause Eve"}</span>
            </Button>
            <span className="topbar-divider" />
            <Button
              variant={chat ? "primary" : "ghost"}
              size="small"
              onClick={() => setChat((x) => !x)}
              aria-expanded={chat}
            >
              <MessageSquare size={16} />
              Ask Eve
            </Button>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <div>
              <FlaskConical size={14} />
              <strong>Demo mode</strong>
              <span>
                A real workflow. Simulated tools. Make yourself at home.
              </span>
            </div>
            <div>
              <button onClick={() => setResetConfirm(true)}>
                <RotateCcw size={12} />
                Reset demo
              </button>
              <Link href="/overview?demo=0">
                Go to live workspace
                <ArrowUpRight size={12} />
              </Link>
            </div>
          </div>
        )}
        {data.workspace.paused && (
          <div className="pause-banner">
            <Pause size={14} />
            All external actions are paused. You can keep reviewing accounts and
            drafts.
          </div>
        )}
        <div className="workspace-body">
          <main
            id="main-content"
            className={cn("main-content", chat && "chat-open")}
          >
            {children}
          </main>
          {chat && <ChatPanel close={() => setChat(false)} />}
        </div>
        <footer className="app-footer">
          <span>
            <Leaf size={12} />
            Built for thoughtful growth.
          </span>
          <span>
            Eve V1 <span className="footer-dot">·</span>{" "}
            {demo
              ? "Your demo stays in this session"
              : "Your workspace, your tools"}
          </span>
        </footer>
      </div>
      <Modal open={search} onOpenChange={setSearch} title="Find your next move">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search accounts, pages, or settings…"
        />
        <div className="command-results">
          {data.accounts
            .filter((a) =>
              `${a.name} ${a.domain}`.toLowerCase().includes(q.toLowerCase()),
            )
            .map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  router.push(href(`/accounts/${a.id}`));
                  setSearch(false);
                }}
              >
                <Avatar initials={a.initials} color={a.color} small />
                <strong>{a.name}</strong>
                <span>{a.domain}</span>
                <ArrowRight size={14} />
              </button>
            ))}
          {nav
            .filter((n) => n.label.toLowerCase().includes(q.toLowerCase()))
            .map((n) => (
              <button
                key={n.href}
                onClick={() => {
                  router.push(href(n.href));
                  setSearch(false);
                }}
              >
                <n.icon size={16} />
                <strong>{n.label}</strong>
                <ArrowRight size={14} />
              </button>
            ))}
        </div>
      </Modal>
      <Modal
        open={resetConfirm}
        onOpenChange={setResetConfirm}
        title="Start fresh?"
        description="This clears the changes in your demo session and restores the original accounts, drafts, and history."
      >
        <div className="modal-actions">
          <Button onClick={() => setResetConfirm(false)}>Keep exploring</Button>
          <Button
            variant="primary"
            onClick={() => {
              reset();
              setResetConfirm(false);
            }}
          >
            Reset demo
          </Button>
        </div>
      </Modal>
      <Modal
        open={mode}
        onOpenChange={setMode}
        title="How much should Eve take on?"
        description="Every action still passes suppression, timing, and account-state checks."
      >
        <div className="authority-options">
          {(
            [
              [
                "observe",
                "Observe",
                "Understand and prepare. All external actions stay as drafts.",
              ],
              [
                "copilot",
                "Copilot",
                "Eve prepares the work. You approve each external action.",
              ],
              [
                "autopilot",
                "Autopilot",
                "Execute within your approved policies. Exceptions come to you.",
              ],
            ] as const
          ).map(([value, label, desc]) => (
            <button
              key={value}
              className={cn(
                "authority-option",
                data.workspace.mode === value && "selected",
              )}
              disabled={!["owner", "admin"].includes(role)}
              onClick={() =>
                void command({ type: "authority", mode: value })
                  .then(() => {
                    toast.success(
                      `${label} mode enabled. Existing actions require review.`,
                    );
                    setMode(false);
                  })
                  .catch(() => {})
              }
            >
              <ShieldCheck size={19} />
              <div>
                <strong>{label}</strong>
                <p>{desc}</p>
              </div>
              {data.workspace.mode === value && <Check size={18} />}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
function ChatPanel({ close }: { close: () => void }) {
  const { data, command, now, demo } = useEve(),
    path = usePathname();
  const account = data.accounts.find((a) => a.id === path.split("/").at(-1));
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>(
    [],
  );
  const [busy, setBusy] = useState(false);
  async function send(value: string) {
    if (!value.trim()) return;
    setText("");
    setMessages((m) => [...m, { role: "user", text: value }]);
    setBusy(true);
    let response = "";
    try {
      const lower = value.toLowerCase();
      if (account && /already.*customer|mark.*customer/.test(lower)) {
        await command({ type: "customer", accountId: account.id });
        response = `${account.name} is now marked as a customer. Obsolete acquisition actions were cancelled, and a CRM update is ready for review.`;
      } else if (account && /pause/.test(lower)) {
        await command({ type: "pause", accountId: account.id, paused: true });
        response = `${account.name} is paused. No external action can execute until you resume it.`;
      } else if (account && /remember|note:/.test(lower)) {
        await command({
          type: "memory",
          accountId: account.id,
          text: value.replace(/^(remember|note:)\s*/i, ""),
        });
        response =
          "Saved as account memory with you as the source. The business-wide playbook is unchanged.";
      } else if (/pause.*calls/.test(lower)) {
        await command({
          type: "propose_policy",
          proposal: {
            id: `proposal-${now}`,
            workspaceId: data.workspace.id,
            title: "Pause outbound calls",
            changes: {
              pausedChannels: [
                ...new Set([
                  ...currentPolicy(data).pausedChannels,
                  "call" as const,
                ]),
              ],
            },
            before: "Calls follow the current authority mode",
            after: "Pause all outbound calls",
            status: "pending",
            createdAt: now,
          },
        });
        response =
          "A policy diff is ready in Playbook → Authority. Review and approve it to pause calling across the workspace.";
      } else if (/50|headcount|employees/.test(lower)) {
        await command({
          type: "propose_policy",
          proposal: {
            id: `proposal-${now}`,
            workspaceId: data.workspace.id,
            title: "Raise the account size threshold",
            changes: { minEmployees: 50 },
            before: `Qualify accounts with ${currentPolicy(data).minEmployees}+ employees`,
            after: "Qualify accounts with 50+ employees",
            status: "pending",
            createdAt: now,
          },
        });
        response =
          "I prepared the 50+ employee policy diff in Playbook → Authority. It needs explicit review before it applies.";
      } else if (account && /why|context|evidence|summar/.test(lower)) {
        response = `${account.summary}\n\nObserved: ${account.observedIntent}.\nInference: ${account.inferredIntent} (${Math.round(account.confidence * 100)}% confidence).\n\n${data.actions.find((a) => a.accountId === account.id && a.status === "pending_approval")?.rationale ?? "No action needs your approval right now."}`;
      } else
        response = `${demo ? "In the rehearsal, " : ""}I can show account evidence, save a note beginning with “Remember”, mark an account as an existing customer, pause an account, or propose a reviewed change to the calling or employee-count policy. Open an account to make account-specific changes.`;
    } catch (e) {
      response =
        e instanceof Error ? e.message : "I couldn’t apply that change.";
    }
    setMessages((m) => [...m, { role: "eve", text: response }]);
    setBusy(false);
  }
  return (
    <aside className="chat-panel">
      <div className="chat-header">
        <div>
          <span className="eve-symbol">e</span>
          <strong>A little help from Eve</strong>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={close}
          aria-label="Close Eve panel"
        >
          <X size={16} />
        </Button>
      </div>
      <div className="chat-context">
        <span className="live-dot" />
        Context: {account?.name ?? "Your workspace"}
      </div>
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-intro">
            <div className="chat-leaf">
              <Leaf size={26} />
            </div>
            <h3>Let’s make a thoughtful move.</h3>
            <p>
              {account
                ? `I have ${account.name}’s evidence, actions, and history in view.`
                : "Ask about an account or propose a change to the way I work."}
            </p>
            {(account
              ? [
                  "Why this next step?",
                  "Pause this account",
                  "They are already a customer",
                ]
              : ["Pause all calls", "Qualify accounts with 50+ employees"]
            ).map((x) => (
              <button key={x} onClick={() => void send(x)}>
                {x}
                <ArrowUpRight size={13} />
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            className={cn("chat-message", m.role === "user" && "chat-user")}
            key={i}
          >
            {m.role === "eve" && <strong>Eve</strong>}
            <p>{m.text}</p>
          </div>
        ))}
        {busy && <p className="muted">Updating the workspace…</p>}
      </div>
      <form
        className="chat-compose"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <textarea
          aria-label="Message Eve"
          placeholder={
            account
              ? `Ask about ${account.name}…`
              : "Give Eve a little direction…"
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(text);
            }
          }}
        />
        <div>
          <span>Changes stay inspectable.</span>
          <Button
            size="icon"
            variant="primary"
            type="submit"
            disabled={busy || !text.trim()}
            aria-label="Send message"
          >
            <ArrowRight size={16} />
          </Button>
        </div>
      </form>
    </aside>
  );
}
