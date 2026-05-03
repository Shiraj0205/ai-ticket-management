import { useMemo, useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  flexRender,
} from "@tanstack/react-table";
import type { SortingState } from "@tanstack/react-table";
import { ChevronUp, ChevronDown, ChevronsUpDown, Search } from "lucide-react";
import { ticketsApi } from "../lib/tickets.js";
import type { SortableTicketField } from "../lib/tickets.js";
import { Skeleton } from "../components/ui/skeleton.js";
import type { Ticket, TicketStatus, TicketCategory } from "../types/index.js";

const STATUS_COLORS: Record<TicketStatus, string> = {
  OPEN: "bg-yellow-100 text-yellow-800",
  RESOLVED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-700",
};

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  GENERAL_QUESTION: "General",
  TECHNICAL_QUESTION: "Technical",
  REFUND_REQUEST: "Refund",
};

const columnHelper = createColumnHelper<Ticket>();

export default function TicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const status = (searchParams.get("status") ?? "") as TicketStatus | "";
  const category = (searchParams.get("category") ?? "") as TicketCategory | "";
  const page = Number(searchParams.get("page") ?? "1");
  const sortBy = (searchParams.get("sortBy") ?? "createdAt") as SortableTicketField;
  const sortOrder = (searchParams.get("sortOrder") ?? "desc") as "asc" | "desc";
  const search = searchParams.get("search") ?? "";

  // Local state drives the input; debounced writes go to the URL
  const [inputValue, setInputValue] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (inputValue) next.set("search", inputValue);
      else next.delete("search");
      next.delete("page");
      setSearchParams(next);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep input in sync when the URL changes externally (back/forward navigation)
  useEffect(() => {
    setInputValue(search);
  }, [search]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["tickets", { status, category, search, page, sortBy, sortOrder }],
    queryFn: () => ticketsApi.list({ status, category, search, page, sortBy, sortOrder }),
  });

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setSearchParams(next);
  }

  function setPage(p: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(p));
    setSearchParams(next);
  }

  function setSorting(newSortBy: SortableTicketField, newSortOrder: "asc" | "desc") {
    const next = new URLSearchParams(searchParams);
    next.set("sortBy", newSortBy);
    next.set("sortOrder", newSortOrder);
    next.delete("page");
    setSearchParams(next);
  }

  const sorting: SortingState = [{ id: sortBy, desc: sortOrder === "desc" }];

  const columns = useMemo(
    () => [
      columnHelper.accessor("subject", {
        header: "Subject",
        enableSorting: true,
        cell: (info) => (
          <Link
            to={`/tickets/${info.row.original.id}`}
            className="font-medium text-blue-600 hover:underline"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor("fromEmail", {
        header: "From",
        enableSorting: true,
        cell: (info) => {
          const t = info.row.original;
          return t.fromName ? (
            <span>
              {t.fromName}{" "}
              <span className="text-gray-400 text-xs">{t.fromEmail}</span>
            </span>
          ) : (
            t.fromEmail
          );
        },
      }),
      columnHelper.accessor("status", {
        header: "Status",
        enableSorting: true,
        cell: (info) => (
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[info.getValue()]}`}
          >
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("category", {
        header: "Category",
        enableSorting: true,
        cell: (info) => (info.getValue() ? CATEGORY_LABELS[info.getValue()!] : "—"),
      }),
      columnHelper.display({
        id: "assignedAgent",
        header: "Assigned",
        enableSorting: false,
        cell: (info) => info.row.original.assignedAgent?.name ?? "—",
      }),
      columnHelper.accessor("createdAt", {
        header: "Created",
        enableSorting: true,
        cell: (info) => new Date(info.getValue()).toLocaleDateString(),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: data?.tickets ?? [],
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      const newSorting = typeof updater === "function" ? updater(sorting) : updater;
      if (newSorting.length === 0) {
        setSorting("createdAt", "desc");
      } else {
        setSorting(
          newSorting[0].id as SortableTicketField,
          newSorting[0].desc ? "desc" : "asc",
        );
      }
    },
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableMultiSort: false,
    sortDescFirst: true,
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Tickets</h1>
        {data && (
          <p className="text-sm text-gray-500 mt-0.5">
            {data.total} {data.total === 1 ? "ticket" : "tickets"} total
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search subject or from…"
            className="border border-gray-300 rounded-md pl-8 pr-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setFilter("status", e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select
          value={category}
          onChange={(e) => setFilter("category", e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">All Categories</option>
          <option value="GENERAL_QUESTION">General Question</option>
          <option value="TECHNICAL_QUESTION">Technical Question</option>
          <option value="REFUND_REQUEST">Refund Request</option>
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-3">
          {(error as Error).message ?? "Failed to load tickets"}
        </p>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      {canSort ? (
                        <button
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex items-center gap-1 hover:text-gray-700 group"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span className="text-gray-400 group-hover:text-gray-500">
                            {sorted === "asc" ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : sorted === "desc" ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronsUpDown className="w-3 h-3 opacity-40" />
                            )}
                          </span>
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-48" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-36" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-20" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-24" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-20" />
                  </td>
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-8 text-sm text-gray-400 text-center"
                >
                  No tickets found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-5 py-3 text-sm text-gray-500">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
