import { useEffect, useMemo, useState } from "react";
import type { MockState } from "../../lib/mock/types";
import type { Player, Position } from "../../types";
import {
  available,
  bestAvailableId,
  botPickId,
  currentTeamIndex,
  isComplete,
  teamRosterPositions,
} from "../../lib/mock/engine";
import { userPickMarkers, formatPick } from "../../lib/mock/board";
import { PickStrip } from "./PickStrip";
import { DraftBoardGrid } from "./DraftBoardGrid";
import { OnTheClockBanner } from "./OnTheClockBanner";

interface Props {
  state: MockState;
  userTeamIndex: number; // userSlot - 1
  onDraft: (playerId: string) => void; // user pick
  onBotTick: () => void; // advance one bot pick
  onUndo: () => void;
  onExit: () => void;
  onReplacePick: (overall: number, playerId: string) => void;
  onRewindTo: (overall: number) => void;
}

const POS_FILTERS: (Position | "All")[] = [
  "All",
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DST",
];

const BOT_DELAY = 850;

export function MockDraft({
  state,
  userTeamIndex,
  onDraft,
  onBotTick,
  onUndo,
  onExit,
  onReplacePick,
  onRewindTo,
}: Props) {
  const [posFilter, setPosFilter] = useState<Position | "All">("All");
  const [boardOpen, setBoardOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [menuFor, setMenuFor] = useState<number | null>(null); // pick popover
  const [replaceSearch, setReplaceSearch] = useState("");
  const [timerSec, setTimerSec] = useState<number | null>(60); // null = Off
  const [remaining, setRemaining] = useState(60);
  const onClock = currentTeamIndex(state);
  const isUser = onClock === userTeamIndex && !isComplete(state);
  const overall = state.picks.length + 1;
  const round = Math.floor((overall - 1) / state.settings.teams) + 1;

  // Reset the clock to full on a new pick, a duration change, or resuming from a
  // pause. The pause case only reaches the user's clock via undo-on-your-turn
  // (which pauses); a fresh full clock there is intended, not a resume mid-count.
  useEffect(() => {
    if (timerSec != null) setRemaining(timerSec);
  }, [overall, timerSec, paused]);

  // Countdown + auto-pick (user's live, unpaused turn only).
  useEffect(() => {
    if (timerSec == null || paused || !isUser) return;
    if (remaining <= 0) {
      const id = bestAvailableId(state);
      if (id) onDraft(id);
      return;
    }
    const t = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timerSec, paused, isUser, remaining, state, onDraft]);

  // Bots pick automatically while running. Pausing (or a dry pool that leaves a
  // bot with no legal pick) stops the timer so the draft can't spin or fight an
  // undo.
  useEffect(() => {
    if (paused || isComplete(state) || onClock === userTeamIndex) return;
    if (!botPickId(state)) {
      setPaused(true); // stall guard: nothing legal to draft
      return;
    }
    const t = setTimeout(onBotTick, BOT_DELAY);
    return () => clearTimeout(t);
  }, [state, paused, onClock, userTeamIndex, onBotTick]);

  const avail = useMemo(
    () =>
      available(state).filter(
        (p) => posFilter === "All" || p.position === posFilter,
      ),
    [state, posFilter],
  );

  const myPositions = teamRosterPositions(state, userTeamIndex);

  // Build the available list interleaved with "your pick" dotted lines. Each
  // line is placed by the player's NATURAL position in the full board order, so
  // it stays at its true round even when the list is filtered by position (a
  // line sits just above the first visible player at/after that board slot).
  type AvailRow =
    | { kind: "line"; round: number; key: string }
    | { kind: "player"; p: Player };
  const availRows = useMemo<AvailRow[]>(() => {
    const full = available(state);
    const fullIndex = new Map(full.map((p, i) => [p.id, i]));
    const markers = isComplete(state)
      ? []
      : userPickMarkers(state, userTeamIndex);
    const rows: AvailRow[] = [];
    let mi = 0;
    for (const p of avail.slice(0, 100)) {
      const f = fullIndex.get(p.id) ?? Infinity;
      while (mi < markers.length && markers[mi].availIndex <= f) {
        rows.push({
          kind: "line",
          round: markers[mi].round,
          key: `m${markers[mi].overall}`,
        });
        mi += 1;
      }
      rows.push({ kind: "player", p });
    }
    // your later picks fall past the last visible player — show them trailing
    while (mi < markers.length) {
      rows.push({
        kind: "line",
        round: markers[mi].round,
        key: `m${markers[mi].overall}`,
      });
      mi += 1;
    }
    return rows;
  }, [state, avail, userTeamIndex]);

  // Undo / resume-from-here edit history, so pause the bots — otherwise they'd
  // immediately re-draft the slot you just cleared.
  const undoAndPause = () => {
    onUndo();
    setPaused(true);
  };
  const resumeFromHere = (o: number) => {
    onRewindTo(o);
    setPaused(true);
    setMenuFor(null);
  };

  const status = isComplete(state)
    ? "Draft complete"
    : isUser
    // TODO: On The Clock. should be the "logo" here. Match the colors exactly. In fact, let's make every instance of On The Clock. be the same as the logo
      ? "You are now... On The Clock."
      : paused
        ? `Paused — Team ${onClock + 1}`
        : `Team ${onClock + 1} picking…`;

  const timerUi = (
    <span className="mock-timer-wrap">
      <span className={`mock-timer ${remaining <= 10 ? "urgent" : ""}`}>
        {timerSec == null
          ? "—"
          : `${Math.floor(Math.max(remaining, 0) / 60)}:${String(
              Math.max(remaining, 0) % 60,
            ).padStart(2, "0")}`}
      </span>
      <select
        className="mock-timer-sel"
        value={timerSec ?? "off"}
        onChange={(e) =>
          setTimerSec(e.target.value === "off" ? null : Number(e.target.value))
        }
      >
        <option value="10">0:10</option>
        <option value="30">0:30</option>
        <option value="45">0:45</option>
        <option value="60">1:00</option>
        <option value="90">1:30</option>
        <option value="1200">2:00</option>
        <option value="off">Off</option>
      </select>
    </span>
  );

  return (
    <div className="mock-draft">
      <OnTheClockBanner
        state={state}
        status={status}
        round={round}
        overall={overall}
        isUser={isUser}
        isComplete={isComplete(state)}
        paused={paused}
        onTogglePause={() => setPaused((p) => !p)}
        onUndo={undoAndPause}
        onExit={onExit}
        timer={timerUi}
      />

      <div className="mock-myroster">
        Your team ({myPositions.length}):{" "}
        {myPositions.length ? myPositions.join(" · ") : "—"}
      </div>

      <div className="mock-boardtoggle">
        <button
          className={boardOpen ? "active" : ""}
          onClick={() => setBoardOpen((v) => !v)}
        >
          {boardOpen ? "Hide board" : "Draft board"}
        </button>
      </div>

      <div className="chips">
        {POS_FILTERS.map((p) => (
          <button
            key={p}
            className={posFilter === p ? "chip active" : "chip"}
            onClick={() => setPosFilter(p)}
          >
            {p}
          </button>
        ))}
      </div>

      <ul className="mock-available">
        {availRows.map((row) =>
          row.kind === "line" ? (
            <li className="mock-pick-line" aria-hidden="true" key={row.key}>
              <span className="mock-pick-line-label">R{row.round}</span>
              <span className="mock-pick-line-rule" />
            </li>
          ) : (
            <li key={row.p.id}>
              <span className="mock-name">{row.p.name}</span>
              <span className="mock-pos">{row.p.position}</span>
              <span className="mock-team">{row.p.team}</span>
              <span className="mock-adp num">
                {row.p.adp == null ? "" : Number(row.p.adp.toFixed(1))}
              </span>
              <button
                className="mock-draft-btn"
                disabled={!isUser}
                onClick={() => onDraft(row.p.id)}
              >
                Draft
              </button>
            </li>
          ),
        )}
      </ul>

      <DraftBoardGrid
        state={state}
        open={boardOpen}
        onClose={() => setBoardOpen(false)}
        canDraft={isUser}
        onDraft={onDraft}
        onPickClick={(o) => setMenuFor(o)}
      />
      <PickStrip state={state} onPickClick={(o) => setMenuFor(o)} />

      {/* Edit a made pick: resume from here, replace the player, or undo it. */}
      {menuFor != null && (
        <>
          <div className="pickmenu-scrim" onClick={() => setMenuFor(null)} />
          <div className="pickmenu">
            <div className="pickmenu-head">
              Pick {formatPick(menuFor, state.settings.teams)}
            </div>
            <button
              className="pickmenu-item"
              onClick={() => resumeFromHere(menuFor)}
            >
              ↩ Resume draft from here
            </button>
            {menuFor === state.picks.length && (
              <button
                className="pickmenu-item"
                onClick={() => {
                  undoAndPause();
                  setMenuFor(null);
                }}
              >
                ✕ Undo this pick
              </button>
            )}

            <div className="pickmenu-replace">
              <div className="pickmenu-replace-label">Replace with…</div>
              <input
                className="pickmenu-search"
                placeholder="Search players…"
                value={replaceSearch}
                onChange={(e) => setReplaceSearch(e.target.value)}
                autoFocus
              />
              <div className="pickmenu-list">
                {available(state)
                  .filter((p) =>
                    p.name.toLowerCase().includes(replaceSearch.toLowerCase()),
                  )
                  .slice(0, 8)
                  .map((p) => (
                    <button
                      key={p.id}
                      className={`pickmenu-row pos-${p.position}`}
                      onClick={() => {
                        onReplacePick(menuFor, p.id);
                        setMenuFor(null);
                        setReplaceSearch("");
                      }}
                    >
                      <span>{p.name}</span>
                      <span className="pickmenu-meta">
                        {p.position} · {p.team}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
