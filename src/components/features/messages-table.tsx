"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import { format } from "date-fns";
import Link from "next/link";
import { useMemo, useState } from "react";

type MessageRow = {
  id: string;
  mailboxEmail: string;
  direction: "incoming" | "outgoing";
  fromText: string;
  toText: string;
  subject: string | null;
  snippet: string | null;
  receivedAt: string | null;
};

export function MessagesTable({ rows }: { rows: MessageRow[] }) {
  const [sorting, setSorting] = useState([{ id: "receivedAt", desc: true }]);

  const columns = useMemo<ColumnDef<MessageRow>[]>(
    () => [
      {
        accessorKey: "receivedAt",
        header: "Time",
        cell: ({ row }) => {
          const value = row.original.receivedAt;
          return value ? format(new Date(value), "yyyy-MM-dd HH:mm") : "-";
        }
      },
      {
        accessorKey: "mailboxEmail",
        header: "Mailbox"
      },
      {
        accessorKey: "direction",
        header: "Direction"
      },
      {
        accessorKey: "fromText",
        header: "From"
      },
      {
        accessorKey: "toText",
        header: "To"
      },
      {
        accessorKey: "subject",
        header: "Subject",
        cell: ({ row }) => (
          <Link className="font-semibold text-teal-700 hover:underline" href={`/messages/${row.original.id}`}>
            {row.original.subject ?? "(no subject)"}
          </Link>
        )
      },
      {
        accessorKey: "snippet",
        header: "Snippet"
      }
    ],
    []
  );

  const table = useReactTable({
    columns,
    data: rows,
    state: { sorting },
    onSortingChange: (next) => setSorting(typeof next === "function" ? next(sorting) : next),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return (
    <div className="overflow-hidden rounded-3xl border border-stone-300 bg-white/95">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-100 text-stone-700">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 text-left font-semibold">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-stone-200">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-top text-stone-800">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
