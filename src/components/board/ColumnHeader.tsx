import type { ColumnDef } from "../../lib/columns";
import type { SortKey } from "../../types";

interface Props {
  columns: ColumnDef[];
  sortKey: SortKey | null; // null => grouped by tier
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
}

export function ColumnHeader({ columns, sortKey, sortAsc, onSort }: Props) {
  return (
    <tr>
      {columns.map((c) => {
        const sorted = c.sortable && c.sortKey === sortKey;
        const cls =
          `col-${c.id}` +
          (c.sortable ? " sortable" : "") +
          (sorted ? " sorted" : "");
        return (
          <th
            key={c.id}
            className={cls}
            onClick={
              c.sortable && c.sortKey ? () => onSort(c.sortKey!) : undefined
            }
            aria-sort={
              sorted ? (sortAsc ? "ascending" : "descending") : undefined
            }
          >
            {c.label}
            {c.sortable && (
              <span className="sort-arrow">
                {sorted ? (sortAsc ? " ▲" : " ▼") : ""}
              </span>
            )}
          </th>
        );
      })}
    </tr>
  );
}
