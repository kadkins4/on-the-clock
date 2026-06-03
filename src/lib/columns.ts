import type { SortKey } from "../types";

export type ColumnId =
  | "mover"
  | "draft"
  | "flag"
  | "rank"
  | "name"
  | "pos"
  | "team"
  | "adp"
  | "vor"
  | "bye"
  | "notes";

export interface ColumnDef {
  id: ColumnId;
  label: string; // header text (empty string => no header label)
  locked?: boolean; // un-hideable & un-movable (Phase 4 enforces; declared now)
  sortable: boolean;
  sortKey?: SortKey; // the key passed to sortPlayers; required when sortable
  align: "l" | "c" | "r";
  width: string; // CSS width applied to the column
}

// The current board, 1:1 with today's hardcoded <thead>/<td> order.
export const COLUMN_DEFS: ColumnDef[] = [
  {
    id: "mover",
    label: "",
    locked: true,
    sortable: false,
    align: "c",
    width: "1.7rem",
  },
  { id: "draft", label: "Draft", sortable: false, align: "c", width: "2.6rem" },
  { id: "flag", label: "★/⚑", sortable: false, align: "c", width: "2rem" },
  {
    id: "rank",
    label: "#",
    sortable: true,
    sortKey: "overall",
    align: "c",
    width: "2.2rem",
  },
  {
    id: "name",
    label: "Player",
    locked: true,
    sortable: true,
    sortKey: "name",
    align: "l",
    width: "16rem",
  },
  {
    id: "pos",
    label: "Pos",
    sortable: true,
    sortKey: "pos",
    align: "c",
    width: "4rem",
  },
  { id: "team", label: "Team", sortable: false, align: "c", width: "3rem" },
  {
    id: "adp",
    label: "ADP",
    sortable: true,
    sortKey: "adp",
    align: "c",
    width: "4.2rem",
  },
  {
    id: "vor",
    label: "VOR",
    sortable: true,
    sortKey: "vor",
    align: "r",
    width: "3.5rem",
  },
  {
    id: "bye",
    label: "Bye",
    sortable: true,
    sortKey: "bye",
    align: "c",
    width: "2.6rem",
  },
  {
    id: "notes",
    label: "Notes",
    sortable: false,
    align: "l",
    width: "auto",
  },
];

export const DEFAULT_COLUMN_ORDER: ColumnId[] = COLUMN_DEFS.map((c) => c.id);

const BY_ID = new Map<ColumnId, ColumnDef>(COLUMN_DEFS.map((c) => [c.id, c]));

// Resolve an ordered list of column ids to their defs, dropping unknown ids.
export function orderedColumns(order: ColumnId[]): ColumnDef[] {
  return order.map((id) => BY_ID.get(id)).filter((c): c is ColumnDef => !!c);
}
