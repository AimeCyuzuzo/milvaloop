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
  type Row,
  type RowSelectionState,
  type SortingState,
  type Table as TanstackTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@milvaloop/ui/button';
import { Checkbox } from '@milvaloop/ui/checkbox';
import { Input } from '@milvaloop/ui/input';
import { cn } from '@milvaloop/ui/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@milvaloop/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@milvaloop/ui/table';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

const SELECT_COLUMN_ID = 'select';

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
  /** A stable identity for a row, used as the row-selection key. Required
   * whenever `selectionActions` is passed — falls back to array index
   * otherwise, which is only safe for a table that never enables selection
   * (an index is meaningless once rows are sorted, filtered, or paged). */
  getRowId?: (row: TData) => string;
  /**
   * Turns on a checkbox column and renders this in a floating bar once at
   * least one row is selected — "approve these", "reject these", etc.
   * `clearSelection` lets the caller reset the checkboxes once its action
   * completes. Selection state lives here, not per call site, for the same
   * reason sorting/filtering do: one table, one place that owns it.
   */
  selectionActions?: (selectedRows: TData[], clearSelection: () => void) => React.ReactNode;
  /**
   * Renders each row as a stacked card below the `md` breakpoint instead
   * of the table's own horizontally-scrolling row — for a table whose
   * columns don't meaningfully fit a phone width (several always-visible
   * columns, a wide badge list, ...). The table itself is unchanged at
   * `md`+; this only replaces what a narrower screen sees, using the same
   * sorted/filtered/paginated row set either way. Receives the full
   * TanStack `Row`, not just its data, so a card can still show a
   * selection checkbox or any other row-level state if it needs to.
   */
  mobileCard?: (row: Row<TData>) => React.ReactNode;
}

// Sorting, a single global text filter, pagination, and (opt-in) row
// selection — what every real table in this product needs (member lists,
// contribution history, audit logs) — wired once here via TanStack Table's
// headless hooks instead of re-hand-rolling this per feature. Per-column/
// faceted filters aren't included; add them here (not per call site) once
// a table actually needs one.
export function DataTable<TData, TValue>({
  columns,
  data,
  filterPlaceholder,
  filters,
  pageSize = 10,
  getRowId,
  selectionActions,
  mobileCard,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const tableColumns = React.useMemo(
    () => (selectionActions ? [buildSelectColumn<TData, TValue>(), ...columns] : columns),
    [columns, selectionActions],
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    getRowId: getRowId ?? ((_row, index) => String(index)),
    state: { sorting, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: Boolean(selectionActions),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);

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

      {mobileCard ? (
        <div className="flex flex-col gap-3 md:hidden">
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => <React.Fragment key={row.id}>{mobileCard(row)}</React.Fragment>)
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">No results.</p>
          )}
        </div>
      ) : null}

      {/* No outer card/ring here — the table sits directly on the page,
          the tinted header row is its own visual boundary. overflow-hidden
          only exists so that tint's corners clip to the radius below. */}
      <div className={cn('overflow-hidden rounded-xl', mobileCard && 'hidden md:block')}>
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
                <TableRow key={row.id} className="group" data-state={row.getIsSelected() ? 'selected' : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={tableColumns.length} className="text-muted-foreground h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination table={table} />

      {selectionActions && selectedRows.length > 0 ? (
        // bottom-24 (not bottom-6) below md clears the fixed mobile bottom
        // tab bar — same clearance the page's own <main> already reserves.
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-4 md:bottom-6">
          {selectionActions(selectedRows, () => setRowSelection({}))}
        </div>
      ) : null}
    </div>
  );
}

function buildSelectColumn<TData, TValue>(): ColumnDef<TData, TValue> {
  return {
    id: SELECT_COLUMN_ID,
    enableSorting: false,
    // A bare Checkbox is a real 16px box with nothing to grow its tap
    // target — fine where one sits next to its own clickable Label (a
    // permissions form, say), but there's no label here to lean on. Sized
    // up directly, as a real child of the cell rather than behind a
    // wrapper div, so table.tsx's own `[&>[role=checkbox]]` alignment rule
    // still applies — a wrapper would put a `div` between the cell and
    // the checkbox and silently break it.
    header: ({ table }) => (
      <Checkbox
        className="size-5"
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
        onCheckedChange={(checked) => table.toggleAllPageRowsSelected(Boolean(checked))}
        aria-label="Select all rows on this page"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        className="size-5"
        checked={row.getIsSelected()}
        onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
        aria-label="Select row"
      />
    ),
  };
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
