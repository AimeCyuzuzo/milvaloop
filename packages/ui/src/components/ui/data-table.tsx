'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type Table as TanstackTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@milvaloop/ui/button';
import { Input } from '@milvaloop/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@milvaloop/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@milvaloop/ui/table';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Placeholder for the built-in global text filter. Omit to hide the filter input entirely. */
  filterPlaceholder?: string;
  /**
   * Extra filter controls (a status dropdown, a date range, ...) rendered
   * next to the search input. Domain-specific filtering stays out of this
   * generic component — the caller wires whatever controls it needs and
   * passes them here rather than this component guessing at every table's
   * filter shape.
   */
  filters?: React.ReactNode;
  /** Rows per page to start on. Defaults to 10. */
  pageSize?: number;
}

// Sorting, a single global text filter, and pagination — the three things
// every real table in this product needs (member lists, contribution
// history, audit logs) — wired once here via TanStack Table's headless
// hooks instead of re-hand-rolling pagination math per feature. Per-column
// filters/faceted filters/row selection aren't included; add them here
// (not per call site) once a second table actually needs one.
export function DataTable<TData, TValue>({
  columns,
  data,
  filterPlaceholder,
  filters,
  pageSize = 10,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  return (
    <div className="flex flex-col gap-4">
      {filterPlaceholder || filters ? (
        <div className="flex flex-wrap items-center gap-2">
          {filterPlaceholder ? (
            <Input
              value={globalFilter}
              onChange={(e) => table.setGlobalFilter(e.target.value)}
              placeholder={filterPlaceholder}
              className="max-w-sm"
            />
          ) : null}
          {filters}
        </div>
      ) : null}

      {/* No outer card/ring here — the table sits directly on the page,
          the tinted header row is its own visual boundary. overflow-hidden
          only exists so that tint's corners clip to the radius below. */}
      <div className="overflow-hidden rounded-2xl">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const sortDirection = header.column.getIsSorted();
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          className="flex items-center gap-1.5 select-none"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sortDirection === 'asc' ? (
                            <ArrowUp className="size-3.5" />
                          ) : sortDirection === 'desc' ? (
                            <ArrowDown className="size-3.5" />
                          ) : (
                            <ArrowUpDown className="text-muted-foreground/50 size-3.5" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="group">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-muted-foreground h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination table={table} />
    </div>
  );
}

function DataTablePagination<TData>({ table }: { table: TanstackTable<TData> }) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const rowCount = table.getFilteredRowModel().rows.length;
  const from = rowCount === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(rowCount, (pageIndex + 1) * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-muted-foreground text-sm">
        {rowCount === 0 ? 'No rows' : `${from}–${to} of ${rowCount}`}
      </p>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Rows per page</span>
          <Select value={`${pageSize}`} onValueChange={(value) => table.setPageSize(Number(value))}>
            <SelectTrigger size="sm" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-muted-foreground text-sm">
          Page {pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous page"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next page"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
