"use client";
import { useRouter, useSearchParams } from "next/navigation";
import {
  SlidersHorizontal,
  ArrowDownWideNarrow,
  Download,
  Building2,
  Filter,
} from "lucide-react";
import { useEve } from "../eve-provider";
import { useEveHref } from "../shell";
import { AccountsTable } from "../accounts-table";
import { SearchInput, Button, Badge, cn } from "../ui";
export function Accounts() {
  const { data } = useEve(),
    href = useEveHref(),
    params = useSearchParams(),
    router = useRouter();
  const q = params.get("q") ?? "",
    filter = params.get("filter") ?? "all";
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/accounts?${next}`, { scroll: false });
  };
  const rows = data.accounts
    .filter(
      (a) =>
        (filter === "all" ||
          (filter === "high" && a.fit === "high") ||
          (filter === "needs_attention" &&
            data.actions.some(
              (x) => x.accountId === a.id && x.status === "pending_approval",
            )) ||
          (filter === "customers" && a.stage === "customer") ||
          (filter === "paused" && a.paused)) &&
        `${a.name} ${a.domain} ${data.contacts.find((c) => c.id === a.contactId)?.name ?? ""}`
          .toLowerCase()
          .includes(q.toLowerCase()),
    )
    .sort((a, b) =>
      params.get("sort") === "name"
        ? a.name.localeCompare(b.name)
        : b.lastSignalAt - a.lastSignalAt,
    );
  function exportCSV() {
    const csv = [
      "Company,Domain,Fit,Stage,Observed signal,Inferred intent",
      ...rows.map((a) =>
        [a.name, a.domain, a.fit, a.stage, a.observedIntent, a.inferredIntent]
          .map((x) => `"${x.replaceAll('"', '""').replace(/^[=+@-]/, "'")}"`)
          .join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "eve-accounts.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CONTEXT BEFORE CONTACT</div>
          <h1>Accounts</h1>
          <p>The people, signals, and next steps behind your pipeline.</p>
        </div>
        <Button onClick={exportCSV}>
          <Download size={14} />
          Export view
        </Button>
      </div>
      <div className="accounts-tabs">
        {[
          ["all", "All accounts"],
          ["needs_attention", "Needs attention"],
          ["high", "High fit"],
          ["customers", "Customers"],
          ["paused", "Paused"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={cn(filter === id && "active")}
            onClick={() => update("filter", id)}
          >
            {label}
            {id === "all" && <span>{data.accounts.length}</span>}
            {id === "needs_attention" && (
              <span>
                {
                  new Set(
                    data.actions
                      .filter((a) => a.status === "pending_approval")
                      .map((a) => a.accountId),
                  ).size
                }
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="table-toolbar">
        <SearchInput
          value={q}
          onChange={(v) => update("q", v)}
          placeholder="Search company, domain, or contact…"
        />
        <div>
          <span className="muted">{rows.length} accounts</span>
          <Button
            size="small"
            onClick={() =>
              update("sort", params.get("sort") === "name" ? "recent" : "name")
            }
          >
            <ArrowDownWideNarrow size={14} />
            {params.get("sort") === "name" ? "Company name" : "Latest activity"}
          </Button>
        </div>
      </div>
      <div className="table-card">
        <AccountsTable accounts={rows} />
      </div>
      <div className="table-summary">
        <span>Fit is based on your confirmed playbook.</span>
        <span>Inferred intent is always labeled.</span>
      </div>
    </div>
  );
}
