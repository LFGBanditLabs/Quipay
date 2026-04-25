import React, { useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export interface VirtualizedTableColumn<T> {
  header: string;
  width?: string;
  render: (item: T) => React.ReactNode;
}

export interface VirtualizedTableProps<T> {
  items: T[];
  columns: VirtualizedTableColumn<T>[];
  keyExtractor: (item: T) => string | number;
  containerHeight?: number;
  rowHeight?: number;
  onRowClick?: (item: T) => void;
  className?: string;
}

/**
 * VirtualizedTable component using @tanstack/react-virtual for efficient rendering.
 * Renders only visible rows, enabling smooth scrolling through 1000+ items.
 *
 * Performance targets:
 * - 1000 rows: < 200ms render time
 * - No jank during scroll
 * - Smooth virtualization with buffer
 */
export const VirtualizedTable = React.forwardRef<
  HTMLDivElement,
  VirtualizedTableProps<any>
>(
  (
    {
      items,
      columns,
      keyExtractor,
      containerHeight = 600,
      rowHeight = 48,
      onRowClick,
      className = "",
    },
    ref
  ) => {
    // Virtualize rows
    const rowVirtualizer = useVirtualizer({
      count: items.length,
      getScrollElement: () =>
        ref instanceof HTMLDivElement ? ref : document.getElementById("table-container"),
      estimateSize: () => rowHeight,
      overscan: 10, // Render 10 rows outside viewport for smoother scrolling
    });

    const virtualRows = rowVirtualizer.getVirtualItems();
    const totalSize = rowVirtualizer.getTotalSize();

    const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0;
    const paddingBottom =
      virtualRows.length > 0
        ? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0)
        : 0;

    // Row count indicator
    const rowCountText = useMemo(() => {
      if (items.length === 0) return "No rows";
      const visibleStart = 1;
      const visibleEnd = Math.min(virtualRows.length, items.length);
      return `Showing ${visibleStart}–${visibleEnd} of ${items.length} rows`;
    }, [items.length, virtualRows.length]);

    return (
      <div className="flex flex-col gap-3">
        {/* Row count indicator */}
        <div className="text-xs text-slate-400">{rowCountText}</div>

        {/* Virtualized container */}
        <div
          ref={ref}
          id="table-container"
          className={`overflow-y-auto overflow-x-hidden rounded-xl border border-indigo-500/15 bg-slate-900/45 ${className}`}
          style={{ height: `${containerHeight}px` }}
        >
          <table className="w-full border-collapse text-sm">
            {/* Fixed header */}
            <thead className="sticky top-0 bg-slate-800/80 backdrop-blur-sm z-10">
              <tr>
                {columns.map((col, idx) => (
                  <th
                    key={idx}
                    className="border-b border-indigo-500/20 px-4 py-3 text-left font-semibold text-slate-200"
                    style={{ width: col.width }}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Virtualized body */}
            <tbody>
              {paddingTop > 0 && (
                <tr>
                  <td colSpan={columns.length} style={{ height: paddingTop }} />
                </tr>
              )}

              {virtualRows.map((virtualRow) => {
                const item = items[virtualRow.index];
                return (
                  <tr
                    key={keyExtractor(item)}
                    onClick={() => onRowClick?.(item)}
                    className={`border-b border-indigo-500/10 transition ${
                      onRowClick
                        ? "cursor-pointer hover:bg-indigo-500/10"
                        : ""
                    }`}
                  >
                    {columns.map((col, colIdx) => (
                      <td
                        key={colIdx}
                        className="px-4 py-3"
                        style={{ width: col.width }}
                      >
                        {col.render(item)}
                      </td>
                    ))}
                  </tr>
                );
              })}

              {paddingBottom > 0 && (
                <tr>
                  <td colSpan={columns.length} style={{ height: paddingBottom }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
);

VirtualizedTable.displayName = "VirtualizedTable";
