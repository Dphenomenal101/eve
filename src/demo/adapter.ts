import {
  applyCommand,
  claimAction,
  finishAction,
  ingest,
  recordOutcome,
  savePageRevision,
  proposeActivation,
  scoped,
} from "../domain/engine";
import {
  datasetSchema,
  type Command,
  type Dataset,
  type ProductEvent,
} from "../domain/schema";
import { DEMO_NOW, demoData } from "./demo-data";
/** Deliberately depends only on domain code. Live adapters cannot be reached from here. */
export class DemoRepository {
  private state: Dataset = structuredClone(demoData);
  private listeners = new Set<() => void>();
  private tick = 0;
  getSnapshot = () => this.state;
  getServerSnapshot = () => demoData;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  now = () => DEMO_NOW + this.tick * 1000;
  hydrate() {
    try {
      const saved = sessionStorage.getItem("eve-demo-v1");
      if (saved) {
        const parsed = datasetSchema.safeParse(JSON.parse(saved));
        if (parsed.success && parsed.data.workspace.id === "demo-meridian") {
          this.state = parsed.data;
          this.tick = Math.max(
            0,
            ...parsed.data.auditEntries.map((e) =>
              Math.ceil((e.createdAt - DEMO_NOW) / 1000),
            ),
          );
          this.notify();
        }
      }
    } catch {
      /* Private browsing may disable storage. */
    }
  }
  private notify() {
    try {
      sessionStorage.setItem("eve-demo-v1", JSON.stringify(this.state));
    } catch {}
    for (const listener of this.listeners) listener();
  }
  reset = () => {
    this.state = structuredClone(demoData);
    this.tick = 0;
    this.notify();
  };
  async command(command: Command) {
    this.tick++;
    this.state = applyCommand(
      this.state,
      command,
      { id: "Alex Morgan", role: "owner" },
      this.now(),
    );
    this.executeDue();
    this.notify();
  }
  async event(event: ProductEvent) {
    this.tick++;
    const result = ingest(this.state, event, this.now());
    this.state = result.state;
    this.executeDue();
    this.notify();
    return { duplicate: result.duplicate, accountId: result.accountId };
  }
  async outcome(
    accountId: string,
    type: "reply" | "booking" | "unsubscribe",
    text: string,
  ) {
    this.tick++;
    this.state = recordOutcome(
      this.state,
      accountId,
      type,
      text,
      `${type}-${accountId}-${this.tick}`,
      this.now(),
    );
    this.executeDue();
    this.notify();
  }
  async generate(accountId: string) {
    this.tick++;
    const s = structuredClone(this.state);
    const account = scoped(s, s.accounts, accountId);
    if (!s.pageSpecs.some((p) => p.accountId === accountId))
      proposeActivation(s, account, this.now());
    const page = s.pageSpecs.filter((p) => p.accountId === accountId).at(-1)!;
    const spec = structuredClone(page.spec);
    spec.elements.hero.props.title =
      account.stage === "qualified"
        ? `A shared starting point for ${account.name}.`
        : `A clearer path for the ${account.name} team.`;
    if (spec.elements.root.children)
      spec.elements.root.children = [
        "hero",
        "steps",
        "context",
        "cta",
        "footer",
      ];
    this.state = savePageRevision(s, accountId, spec, this.now());
    this.notify();
  }
  private executeDue() {
    for (const action of [...this.state.actions]) {
      if (action.status !== "scheduled") continue;
      const claimed = claimAction(this.state, action.id, this.now());
      this.state = claimed.state;
      if (claimed.claimed)
        this.state = finishAction(
          this.state,
          action.id,
          { providerId: `simulated-${action.kind}-${action.id}` },
          this.now(),
        );
    }
  }
}
