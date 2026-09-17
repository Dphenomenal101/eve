"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  ConvexReactClient,
  useQuery,
  useMutation,
  useAction,
} from "convex/react";
import {
  ConvexBetterAuthProvider,
  type AuthClient,
} from "@convex-dev/better-auth/react";
import { useSearchParams } from "next/navigation";
import { makeFunctionReference } from "convex/server";
import { toast } from "sonner";
import { DemoRepository } from "@/demo/adapter";
import { authClient } from "@/lib/auth-client";
import type {
  Command,
  Dataset,
  ProductEvent,
  Provider,
  Role,
} from "@/domain/schema";
import { Button } from "@/components/ui";

export type EveContextValue = {
  data: Dataset;
  demo: boolean;
  now: number;
  role: Role;
  busy: boolean;
  command: (command: Command) => Promise<void>;
  event: (event: ProductEvent) => Promise<unknown>;
  outcome: (
    id: string,
    type: "reply" | "booking" | "unsubscribe",
    text: string,
  ) => Promise<void>;
  reset: () => void;
  connect: (
    provider: Provider,
    secret: string,
    resourceId: string,
    webhookSecret?: string,
  ) => Promise<unknown>;
  verifyCrm: (sessionUri?: string) => Promise<unknown>;
  research: (url: string) => Promise<unknown>;
  generate: (accountId: string) => Promise<unknown>;
  rehearse: () => Promise<unknown>;
};
const EveContext = createContext<EveContextValue | null>(null);
export function useEve() {
  const context = useContext(EveContext);
  if (!context) throw new Error("Eve workspace is unavailable.");
  return context;
}
export function DemoProvider({ children }: { children: ReactNode }) {
  const [repo] = useState(() => new DemoRepository());
  const data = useSyncExternalStore(
    repo.subscribe,
    repo.getSnapshot,
    repo.getServerSnapshot,
  );
  const [busy, setBusy] = useState(false);
  useEffect(() => repo.hydrate(), [repo]);
  async function wrap(task: () => Promise<unknown>) {
    setBusy(true);
    try {
      await task();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "The operation could not be completed.",
      );
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const value: EveContextValue = {
    data,
    demo: true,
    now: repo.now(),
    role: "owner",
    busy,
    command: (c) => wrap(() => repo.command(c)),
    event: (e) => wrap(() => repo.event(e)),
    outcome: (...args) => wrap(() => repo.outcome(...args)),
    reset: () => {
      repo.reset();
      toast.success("Demo restored to its starting point.");
    },
    connect: async () => {
      toast.info(
        "Demo connections are simulated. Switch to your live workspace to connect an account.",
      );
    },
    verifyCrm: async () => {},
    research: async () => {
      toast.info(
        "Demo research uses Meridian’s confirmed brief. No external websites are contacted.",
      );
      return data.businessProfiles[0];
    },
    generate: async (accountId) => {
      await wrap(() => repo.generate(accountId));
      toast.success("A new page revision is ready for review.");
    },
    rehearse: async () => {
      toast.success(
        "Open Acme to approve the prepared page and email, then simulate activation.",
      );
    },
  };
  return <EveContext.Provider value={value}>{children}</EveContext.Provider>;
}
const queryRef = makeFunctionReference<
  "query",
  Record<string, never>,
  { data: Dataset; role: Role } | null
>("workspace:snapshot");
function LiveWorkspace({ children }: { children: ReactNode }) {
  const snapshot = useQuery(queryRef, {});
  const commandMutation = useMutation(
    makeFunctionReference<"mutation">("workspace:command"),
  );
  const connectAction = useAction(
    makeFunctionReference<"action">("providers:connect"),
  );
  const verifyCrmAction = useAction(
    makeFunctionReference<"action">("providers:verifyCrm"),
  );
  const researchAction = useAction(
    makeFunctionReference<"action">("providers:research"),
  );
  const generationAction = useAction(
    makeFunctionReference<"action">("providers:generatePage"),
  );
  const rehearseMutation = useMutation(
    makeFunctionReference<"mutation">("workspace:rehearse"),
  );
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  if (snapshot === undefined)
    return (
      <div className="loading-screen">
        <span className="eve-symbol">e</span>
        <p>Loading your workspace…</p>
      </div>
    );
  if (!snapshot) return <WorkspaceWelcome />;
  const data = snapshot.data;
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Operation failed.");
      throw e;
    } finally {
      setBusy(false);
    }
  };
  return (
    <EveContext.Provider
      value={{
        data,
        demo: false,
        now: clock,
        role: snapshot.role,
        busy,
        command: async (c) => {
          await run(() =>
            commandMutation({ workspaceId: data.workspace.id, command: c }),
          );
        },
        event: async () => {
          throw new Error(
            "Send live events through the authenticated ingestion endpoint.",
          );
        },
        outcome: async () => {
          throw new Error(
            "Live outcomes arrive through signed provider webhooks.",
          );
        },
        reset: () => {},
        connect: (provider, secret, resourceId, webhookSecret) =>
          run(() =>
            connectAction({
              workspaceId: data.workspace.id,
              provider,
              secret,
              resourceId,
              ...(webhookSecret ? { webhookSecret } : {}),
            }),
          ),
        verifyCrm: (sessionUri) =>
          run(() =>
            verifyCrmAction({
              workspaceId: data.workspace.id,
              ...(sessionUri ? { sessionUri } : {}),
            }),
          ),
        research: (url) =>
          run(() => researchAction({ workspaceId: data.workspace.id, url })),
        generate: (accountId) =>
          run(() =>
            generationAction({ workspaceId: data.workspace.id, accountId }),
          ),
        rehearse: () =>
          run(() => rehearseMutation({ workspaceId: data.workspace.id })),
      }}
    >
      {children}
    </EveContext.Provider>
  );
}
function WorkspaceWelcome() {
  const session = authClient.useSession();
  const create = useMutation(
    makeFunctionReference<"mutation">("workspace:create"),
  );
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  if (!session.data)
    return (
      <div className="setup-screen">
        <span className="eve-wordmark">
          eve<span>✳</span>
        </span>
        <h1>
          Your next great customer
          <br />
          is already here.
        </h1>
        <p>Sign in to turn product signals into thoughtful conversations.</p>
        <a className="btn btn-primary" href="/login">
          Sign in to Eve
        </a>
      </div>
    );
  return (
    <div className="setup-screen">
      <span className="eve-wordmark">
        eve<span>✳</span>
      </span>
      <h1>Give Eve a place to work.</h1>
      <p>Create a workspace, then brief Eve on your business.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await create({ name });
          } catch (e) {
            toast.error(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          className="input"
          placeholder="Your company name"
          aria-label="Company name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" variant="primary" loading={busy}>
          Create workspace
        </Button>
      </form>
    </div>
  );
}
export function EveProvider({
  children,
  demoEnabled,
}: {
  children: ReactNode;
  demoEnabled: boolean;
}) {
  const search = useSearchParams();
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const demo =
    demoEnabled &&
    (search.get("demo") === "1" || (!url && search.get("demo") !== "0"));
  const client = useMemo(
    () => (url ? new ConvexReactClient(url) : null),
    [url],
  );
  if (demo) return <DemoProvider>{children}</DemoProvider>;
  if (!client)
    return (
      <div className="setup-screen">
        <span className="eve-wordmark">
          eve<span>✳</span>
        </span>
        <BadgeLine />
        <h1>
          A thoughtful teammate.
          <br />
          Ready when you are.
        </h1>
        <p>
          Connect your Convex deployment to start a live workspace. The complete
          demo is ready to explore without any accounts.
        </p>
        {demoEnabled && (
          <a href="/overview?demo=1" className="btn btn-primary">
            Explore the demo <span>→</span>
          </a>
        )}
        <a
          href="https://github.com/get-convex/better-auth"
          className="text-link"
          target="_blank"
          rel="noreferrer"
        >
          Convex setup reference ↗
        </a>
      </div>
    );
  return (
    <ConvexBetterAuthProvider
      client={client}
      authClient={authClient as unknown as AuthClient}
    >
      <LiveWorkspace>{children}</LiveWorkspace>
    </ConvexBetterAuthProvider>
  );
}
function BadgeLine() {
  return <span className="eyebrow">LIVE WORKSPACE SETUP</span>;
}
