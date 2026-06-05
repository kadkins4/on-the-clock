import type { Dispatch, ReactNode } from "react";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import type { Player, Flag } from "../../types";
import type { Action } from "../../state/reducer";
import type { ColumnId } from "../../lib/columns";
import { nextDraftStatus } from "../../lib/draft";
import { injuryBadge } from "../../lib/injury";

// Everything a cell renderer might need beyond the player itself.
export interface CellCtx {
  positionalRank: number;
  vor: number | null;
  proj: number | null;
  last: number | null;
  rookie: boolean; // no NFL season yet → '25 cell shows "R" instead of "–"
  draggable: boolean;
  startsTier: boolean;
  onAddTier: (playerId: string) => void;
  dispatch: Dispatch<Action>;
  dragAttributes: DraggableAttributes;
  dragListeners: SyntheticListenerMap | undefined;
}

const DRAFT_LABEL: Record<Player["draftStatus"], string> = {
  available: "·",
  mine: "✓",
  taken: "✕",
};

function upd(
  dispatch: Dispatch<Action>,
  id: string,
  patch: Partial<Omit<Player, "id" | "overallRank">>,
) {
  dispatch({ type: "update", id, patch });
}

function adpTitle(p: Player): string | undefined {
  if (!p.adpSources) return undefined;
  const s = p.adpSources;
  return (
    [
      s.espn != null && `ESPN ${s.espn.toFixed(1)}`,
      s.ffc != null && `FFC ${s.ffc.toFixed(1)}`,
      s.fantasypros != null && `FP ${s.fantasypros.toFixed(1)}`,
      s.yahoo != null && `Yahoo ${s.yahoo.toFixed(1)}`,
    ]
      .filter(Boolean)
      .join(" · ") || undefined
  );
}

// One renderer per ColumnId. Each returns the <td> for that column.
export const CELL_RENDERERS: Record<
  ColumnId,
  (p: Player, ctx: CellCtx) => ReactNode
> = {
  mover: (p, ctx) => (
    <td className="mover">
      {ctx.draggable && (
        <>
          <button
            className="add-tier"
            title={
              ctx.startsTier
                ? "Add an empty tier above this player"
                : "Start a new tier here"
            }
            onClick={() => ctx.onAddTier(p.id)}
          >
            ＋
          </button>
          <span
            className="drag-handle"
            {...ctx.dragAttributes}
            {...ctx.dragListeners}
          >
            ⠷
          </span>
        </>
      )}
    </td>
  ),
  draft: (p, ctx) => (
    <td className="draft-cell">
      <button
        className={`draft draft-${p.draftStatus}`}
        onClick={() =>
          upd(ctx.dispatch, p.id, {
            draftStatus: nextDraftStatus(p.draftStatus),
          })
        }
        title={p.draftStatus}
      >
        {DRAFT_LABEL[p.draftStatus]}
      </button>
    </td>
  ),
  flag: (p, ctx) => {
    const cycle = () => {
      const next: Flag =
        p.flag === "none" ? "target" : p.flag === "target" ? "avoid" : "none";
      upd(ctx.dispatch, p.id, { flag: next });
    };
    return (
      <td className="flag-cell">
        <button
          className={`flag flag-${p.flag}`}
          onClick={cycle}
          title={p.flag}
        >
          {p.flag === "target" ? "★" : p.flag === "avoid" ? "⚑" : "·"}
        </button>
      </td>
    );
  },
  rank: (p) => <td className="rank num">{p.overallRank}</td>,
  name: (p) => {
    const inj = injuryBadge(p.injuryStatus);
    return (
      <td className="name-cell" title={p.name}>
        {p.name}
        {inj && (
          <span
            className={`inj inj-${inj.severity}`}
            title={`${inj.label} — ${inj.description}`}
          >
            {inj.code}
          </span>
        )}
      </td>
    );
  },
  pos: (p, ctx) => (
    <td className="pos num">
      {p.position}
      {ctx.positionalRank}
    </td>
  ),
  team: (p) => <td className="team num">{p.team}</td>,
  adp: (p) => (
    <td className="adp num" title={adpTitle(p)}>
      {p.adp == null ? "" : Number(p.adp.toFixed(1))}
    </td>
  ),
  vor: (_p, ctx) => (
    <td className="vor num">
      {ctx.vor == null ? "—" : ctx.vor > 0 ? `+${ctx.vor}` : String(ctx.vor)}
    </td>
  ),
  proj: (_p, ctx) => (
    <td className="proj num">
      {ctx.proj == null ? "–" : Math.round(ctx.proj)}
    </td>
  ),
  last: (_p, ctx) => (
    <td className="last num">
      {ctx.last != null ? Math.round(ctx.last) : ctx.rookie ? "R" : "–"}
    </td>
  ),
  bye: (p) => <td className="bye num">{p.byeWeek ?? ""}</td>,
  notes: (p, ctx) => (
    <td>
      <input
        className="notes"
        value={p.notes}
        onChange={(e) => upd(ctx.dispatch, p.id, { notes: e.target.value })}
      />
    </td>
  ),
};
