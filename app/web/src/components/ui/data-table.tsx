import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type RowData,
  type TableOptions,
} from "@tanstack/react-table";
import { cn } from "~/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    headerClassName?: string;
    cellClassName?: string;
  }
}

type DataTableRowProps = React.HTMLAttributes<HTMLTableRowElement> & {
  [key: `data-${string}`]: string | undefined;
};

type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  emptyContent?: React.ReactNode;
  getRowId?: TableOptions<TData>["getRowId"];
  hideHeader?: boolean;
  rowProps?: (row: Row<TData>) => DataTableRowProps | undefined;
  tableClassName?: string;
};

export function DataTable<TData>({
  columns,
  data,
  emptyContent = "データがありません。",
  getRowId,
  hideHeader = false,
  rowProps,
  tableClassName,
}: Readonly<DataTableProps<TData>>) {
  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
  });

  const rows = table.getRowModel().rows;
  const visibleColumnCount = table.getVisibleLeafColumns().length || 1;

  return (
    <Table className={tableClassName}>
      {!hideHeader ? (
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(header.column.columnDef.meta?.headerClassName)}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
      ) : null}
      <TableBody>
        {rows.length > 0 ? (
          rows.map((row) => {
            const resolvedRowProps = rowProps?.(row);
            const { className, ...restRowProps } = resolvedRowProps ?? {};

            return (
              <TableRow key={row.id} className={cn(className)} {...restRowProps}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(cell.column.columnDef.meta?.cellClassName)}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            );
          })
        ) : (
          <TableRow>
            <TableCell
              colSpan={visibleColumnCount}
              className="py-6 text-center text-sm text-[color:var(--muted-foreground)]"
            >
              {emptyContent}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
