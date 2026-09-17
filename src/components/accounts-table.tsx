"use client";
import Link from "next/link";
import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  ArrowUpRight,
  ArrowDown,
  Activity,
  Mail,
  Globe,
  Pause,
  Clock,
  Check,
} from "lucide-react";
import { useEve } from "./eve-provider";
import { useEveHref } from "./shell";
import { Avatar, Badge, EmptyState } from "./ui";
import { relativeTime, statusTone, titleCase } from "@/lib/format";
import type { Account } from "@/domain/schema";
export function AccountsTable({
  accounts,
  compact = false,
}: {
  accounts: Account[];
  compact?: boolean;
}) {
  const { data, now } = useEve(),
    href = useEveHref();
  const columns = useMemo<ColumnDef<Account>[]>(
    () => [
      {
        id: "company",
        header: "Company",
        cell: ({ row }) => (
          <Link
            href={href(`/accounts/${row.original.id}`)}
            className="table-company"
          >
            <Avatar
              initials={row.original.initials}
              color={row.original.color}
              small
            />
            <span>
              <strong>{row.original.name}</strong>
              <small>
                {data.contacts.find((c) => c.id === row.original.contactId)
                  ?.name ?? row.original.domain}
              </small>
            </span>
          </Link>
        ),
      },
      {
        accessorKey: "fit",
        header: "Fit",
        cell: ({ row }) => (
          <span className={`fit-label fit-${row.original.fit}`}>
            <span className="fit-bars">
              <i />
              <i />
              <i />
            </span>
            {titleCase(row.original.fit)}
          </span>
        ),
      },
      {
        id: "signal",
        header: "Latest signal",
        cell: ({ row }) => (
          <div className="table-signal">
            <span>{row.original.lastSignal.replaceAll("_", " ")}</span>
            <small>{relativeTime(row.original.lastSignalAt, now)}</small>
          </div>
        ),
      },
      {
        accessorKey: "stage",
        header: "Lifecycle",
        cell: ({ row }) => (
          <Badge tone={statusTone(row.original.stage)}>
            {titleCase(row.original.stage)}
          </Badge>
        ),
      },
      ...(!compact
        ? [
            {
              id: "inference",
              header: "Eve’s interpretation",
              cell: ({ row }: { row: { original: Account } }) => (
                <div className="table-signal">
                  <span>{row.original.inferredIntent}</span>
                  <small>
                    {Math.round(row.original.confidence * 100)}% confidence ·
                    inferred
                  </small>
                </div>
              ),
            },
          ]
        : []),
      {
        id: "next",
        header: "Next move",
        cell: ({ row }) => {
          const a = data.actions.find(
            (a) =>
              a.accountId === row.original.id &&
              ["pending_approval", "scheduled", "executing"].includes(a.status),
          );
          return (
            <span className="next-move">
              {row.original.paused ? (
                <>
                  <Pause size={13} />
                  Paused
                </>
              ) : a ? (
                <>
                  {a.kind === "page" ? (
                    <Globe size={13} />
                  ) : a.kind === "email" ? (
                    <Mail size={13} />
                  ) : (
                    <Activity size={13} />
                  )}
                  <span>
                    {a.status === "pending_approval"
                      ? "Your review"
                      : a.status === "scheduled"
                        ? "Scheduled"
                        : "In progress"}
                  </span>
                  {a.status === "pending_approval" && (
                    <span className="amber-dot" />
                  )}
                </>
              ) : (
                <>
                  <span className="muted-dot" />
                  Watching for signals
                </>
              )}
            </span>
          );
        },
      },
      {
        id: "open",
        header: "",
        cell: ({ row }) => (
          <Link
            className="table-open"
            aria-label={`Open ${row.original.name}`}
            href={href(`/accounts/${row.original.id}`)}
          >
            <ArrowUpRight size={15} />
          </Link>
        ),
      },
    ],
    [compact, data.actions, data.contacts, href, now],
  );
  const table = useReactTable({
    data: accounts,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  if (!accounts.length)
    return (
      <EmptyState
        title="Room for your next customer"
        description="Accounts will appear here when Eve receives a product signal. Try the rehearsal to see the loop."
      />
    );
  return (
    <div className="table-scroll">
      <table className="accounts-table">
        <thead>
          {table.getHeaderGroups().map((g) => (
            <tr key={g.id}>
              {g.headers.map((h) => (
                <th key={h.id}>
                  {h.isPlaceholder
                    ? null
                    : flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr key={r.id}>
              {r.getVisibleCells().map((c) => (
                <td key={c.id}>
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
