import React, { useMemo, useState } from "react";

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
  VirtualizedTableProps<unknown>
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
    ref,
  ) => {
    const [scrollTop, setScrollTop] = useState(0);
    const overscan = 10;
    const visibleCount = Math.ceil(containerHeight / rowHeight) + overscan;
    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / rowHeight) - overscan / 2,
    );
    const endIndex = Math.min(items.length, startIndex + visibleCount);

    const visibleItems = items.slice(startIndex, endIndex);
    const paddingTop = startIndex * rowHeight;
    const paddingBottom = Math.max(0, (items.length - endIndex) * rowHeight);

    // Row count indicator
    const rowCountText = useMemo(() => {
      if (items.length === 0) return "No rows";
      const visibleStart = startIndex + 1;
      const visibleEnd = endIndex;
      return `Showing ${visibleStart}–${visibleEnd} of ${items.length} rows`;
    }, [endIndex, items.length, startIndex]);

    return (
      <div className="flex flex-col gap-3">
        {/* Row count indicator */}
        <div className="text-xs text-slate-400">{rowCountText}</div>

        {/* Virtualized container */}
        <div
          ref={ref}
          id="table-container"
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
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

              {visibleItems.map((item) => {
                return (
                  <tr
                    key={keyExtractor(item)}
                    onClick={() => onRowClick?.(item)}
                    className={`border-b border-indigo-500/10 transition ${
                      onRowClick ? "cursor-pointer hover:bg-indigo-500/10" : ""
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
                  <td
                    colSpan={columns.length}
                    style={{ height: paddingBottom }}
                  />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  },
);

VirtualizedTable.displayName = "VirtualizedTable";
