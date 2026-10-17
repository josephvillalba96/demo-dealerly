import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { EmptyState } from "./surface";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  className?: string;
  /** Oculta la columna en pantallas pequeñas. */
  hideBelow?: "md" | "lg";
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: { title: string; description?: string; action?: ReactNode };
  caption: string;
}

const HIDE = { md: "hidden md:table-cell", lg: "hidden lg:table-cell" };

/** Tabla simple y accesible. Sin tarjetas por fila: la separación la dan los espacios y una línea fina. */
export function DataTable<T>({ columns, rows, rowKey, onRowClick, empty, caption }: Props<T>) {
  if (rows.length === 0) return <EmptyState title={empty?.title ?? "Sin resultados"} description={empty?.description} action={empty?.action} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-xs font-medium text-muted">
            {columns.map((c) => (
              <th key={c.header} scope="col" className={cn("px-5 py-3 font-medium", c.align === "right" && "text-right", c.hideBelow && HIDE[c.hideBelow], c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => e.key === "Enter" && onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={cn("transition", onRowClick && "cursor-pointer hover:bg-surface/70 focus-visible:bg-surface/70")}
            >
              {columns.map((c) => (
                <td key={c.header} className={cn("px-5 py-3.5 align-middle text-ink-soft", c.align === "right" && "num text-right", c.hideBelow && HIDE[c.hideBelow], c.className)}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
