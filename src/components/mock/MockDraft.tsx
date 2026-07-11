import { useMemo, useState } from "react";
import type { MockState } from "../../lib/mock/types";
import type { Position } from "../../types";
import {
  availableByBoard,
  currentTeamIndex,
  isComplete,
  teamRosterPositions,
} from "../../lib/mock/engine";
import { detectStrategy } from "../../lib/mock/detect";
import { nudgeCopy } from "../../lib/mock/nudge";
import { StrategyNudge } from "./StrategyNudge";
import { formatPick, picksUntilUser } from "../../lib/mock/board";
import { useDraftTimer } from "./useDraftTimer";
import { useTvBroadcast } from "./useTvBroadcast";
import { usePoolStats } from "./usePoolStats";
import { SearchPill } from "../SearchPill";
import { PickStrip } from "./PickStrip";
import { DraftBoardGrid } from "./DraftBoardGrid";
import { OnTheClockBanner } from "./OnTheClockBanner";
import { StopwatchMark } from "./StopwatchMark";
import { PickPool, type PoolCol, POOL_COL_CAP } from "./PickPool";
import { MockPlayersTable } from "./MockPlayersTable";
import { PlayerPanel } from "./PlayerPanel";
import { DraftShell, type DraftTab } from "./DraftShell";
import { playerDraftStatus } from "../../lib/mock/playerDraftStatus";
import { MyQueue } from "./MyQueue";
import { toggleQueue, pendingQueue } from "../../lib/mock/queue";
import { LockerRoom } from "./LockerRoom";
import { MyRoster } from "./MyRoster";
import { RoundStrip } from "./RoundStrip";
import { TVStage } from "./TVStage";
import { buildTvSnapshot } from "../../lib/mock/tvSnapshot";

interface Props {
  state: MockState;
  userTeamIndex: number; // userSlot - 1
  onDraft: (playerId: string) => void; // user pick
  onBotTick: () => void; // advance one bot pick
  onUndo: () => void;
  onExit: () => void;
  onReplacePick: (overall: number, playerId: string) => void;
  onRewindTo: (overall: number) => void;
  onSimulate: () => void; // dev-mode: fill the whole board instantly
}

// Sim-mode gate (?sim=1): shows the instant-simulate control inside the draft.
// A distinct param from ?dev=1, which replaces the whole app with diagnostics
// and so can't coexist with the live draft.
const simMode =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("sim") === "1";

const POS_FILTERS: (Position | "All")[] = [
  "All",
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DST",
];

export function MockDraft({
  state,
  userTeamIndex,
  onDraft,
  onBotTick,
  onUndo,
  onExit,
  onReplacePick,
  onRewindTo,
  onSimulate,
}: Props) {
  const [posFilter, setPosFilter] = useState<Position | "All">("All");
  // B1: top-level draft-room tab (app-bar). Defaults to the working Draft view
  // so the clock + controls are visible on entry.
  const [tab, setTab] = useState<DraftTab>("draft");
  // B5: My Queue — ordered list of starred player ids. Drafted ones auto-drop
  // from the display via pendingQueue (derived at render, no effect needed).
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [openPlayer, setOpenPlayer] = useState<string | null>(null);
  const [extraCols, setExtraCols] = useState<PoolCol[]>(["bye"]);
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [boardView, setBoardView] = useState<"wall" | "locker">("wall");
  const [menuFor, setMenuFor] = useState<number | null>(null); // pick popover
  const [replaceSearch, setReplaceSearch] = useState("");
  // Suggester: which detected strategy the user has dismissed. Cleared whenever
  // the read changes, so a fresh strategy re-surfaces the nudge.
  const [dismissedStrat, setDismissedStrat] = useState<string | null>(null);

  const onClock = currentTeamIndex(state);
  const team = state.teams[onClock];
  const isUser = onClock === userTeamIndex && !isComplete(state);
  const overall = state.picks.length + 1;
  const round = Math.floor((overall - 1) / state.settings.teams) + 1;
  const picksAway = picksUntilUser(state, userTeamIndex);

  // Suggester: infer the user's strategy from their picks so far. Only surface
  // the nudge once the read is confident (4th pick) and not dismissed — the
  // tentative 3-pick read is intentionally kept silent to avoid a noisy guess.
  const detected = useMemo(
    () => detectStrategy(teamRosterPositions(state, userTeamIndex)),
    [state, userTeamIndex],
  );
  const nudge = nudgeCopy(detected.strategy);
  const showNudge =
    nudge != null &&
    detected.confidence === "high" &&
    detected.strategy !== dismissedStrat;

  // The live draft clock (reveal hold, countdown + auto-pick, bot progression,
  // auto-draft, missed-pick modal, mute) lives in useDraftTimer.
  const {
    timerSec,
    setTimerSec,
    remaining,
    revealing,
    paused,
    setPaused,
    setAutoOn,
    missed,
    setMissed,
    missedLeft,
    muted,
    toggleMute,
    urgent,
  } = useDraftTimer({
    state,
    isUser,
    onClock,
    userTeamIndex,
    overall,
    onDraft,
    onBotTick,
  });

  // Mirror the draft to any open #tv cast window (read-only BroadcastChannel).
  useTvBroadcast(state);

  // Scored PROJ + VOR for the pick pool / player card, computed once per mock
  // from the frozen pool at the league's scoring settings.
  const { projById, vorById } = usePoolStats(state);

  const avail = useMemo(
    () =>
      availableByBoard(state).filter(
        (p) => posFilter === "All" || p.position === posFilter,
      ),
    [state, posFilter],
  );

  // Players tab: full pool (including drafted), filtered by position chip, in
  // overallRank order. Draft tab stays available-only (avail above).
  const fullPool = useMemo(
    () =>
      state.pool
        .filter((p) => posFilter === "All" || p.position === posFilter)
        .slice()
        .sort((a, b) => a.overallRank - b.overallRank),
    [state.pool, posFilter],
  );

  // draftStatusOf for the Players tab: extends PlayerDraftStatus with initials.
  const draftStatusOf = useMemo(
    () => (id: string) => {
      const base = playerDraftStatus(state, id);
      if (!base.drafted) return base;
      const pick = state.picks.find((pk) => pk.playerId === id);
      const initials =
        pick != null ? (state.teams[pick.teamIndex]?.initials ?? "") : "";
      return { ...base, initials };
    },
    [state],
  );

  // B5: queue membership set (for the ★ toggles) and the resolved, ordered,
  // still-pending queue players (drafted ones dropped).
  const queuedSet = useMemo(() => new Set(queueIds), [queueIds]);
  const queuePlayers = useMemo(() => {
    const byId = new Map(state.pool.map((p) => [p.id, p]));
    return pendingQueue(queueIds, state.draftedIds)
      .map((id) => byId.get(id))
      .filter((p): p is (typeof state.pool)[number] => p != null);
  }, [queueIds, state]);
  const onToggleQueue = (id: string) =>
    setQueueIds((ids) => toggleQueue(ids, id));

  const toggleCol = (c: PoolCol) =>
    setExtraCols((cur) =>
      cur.includes(c)
        ? cur.filter((x) => x !== c)
        : cur.length >= POOL_COL_CAP
          ? cur
          : [...cur, c],
    );

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

  const timerUi = (
    <span className="mock-timer-wrap">
      {urgent && <StopwatchMark urgent />}
      <span
        className={`mock-timer ${revealing ? "idle" : remaining <= 10 ? "urgent" : ""}`}
      >
        {timerSec == null
          ? "—"
          : `${Math.floor(Math.max(remaining, 0) / 60)}:${String(
              Math.max(remaining, 0) % 60,
            ).padStart(2, "0")}`}
      </span>
    </span>
  );

  // Shared filter/column toolbar — same for both pool views.
  const filterBar = (
    <div className="filters">
      {POS_FILTERS.map((p) => (
        <button
          key={p}
          className={posFilter === p ? "chip active" : "chip"}
          onClick={() => setPosFilter(p)}
        >
          {p}
        </button>
      ))}
      <div className="colbtn-wrap">
        <button
          className={`colbtn${colMenuOpen ? " active" : ""}`}
          onClick={() => setColMenuOpen((o) => !o)}
          aria-label="Columns"
        >
          ⚙ Columns
        </button>
        {colMenuOpen && (
          <>
            <div
              className="colmenu-scrim"
              onClick={() => setColMenuOpen(false)}
            />
            <div className="colmenu">
              {(["bye", "proj", "vor"] as PoolCol[]).map((c) => {
                const on = extraCols.includes(c);
                return (
                  <button
                    key={c}
                    className={on ? "on" : ""}
                    disabled={!on && extraCols.length >= POOL_COL_CAP}
                    onClick={() => toggleCol(c)}
                  >
                    {c === "bye" ? "Bye" : c === "proj" ? "Proj" : "VOR"}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );

  // DRAFT tab: available-only pool, no draftStatusOf (best-available working list).
  const draftPoolBody = (
    <>
      {filterBar}
      <PickPool
        players={avail.slice(0, 100)}
        canDraft={isUser && !revealing}
        overall={overall}
        extraCols={extraCols}
        onDraft={onDraft}
        onOpenPlayer={(id) => setOpenPlayer(id)}
        queuedIds={queuedSet}
        onToggleQueue={onToggleQueue}
        projById={projById}
        vorById={vorById}
      />
    </>
  );

  // PLAYERS tab: full pool including drafted players, as a dense research table
  // (distinct from the Draft tab's carded Best-Available list).
  const playersPoolBody = (
    <>
      {filterBar}
      <MockPlayersTable
        players={fullPool}
        canDraft={isUser && !revealing}
        onDraft={onDraft}
        onOpenPlayer={(id) => setOpenPlayer(id)}
        draftStatusOf={draftStatusOf}
        queuedIds={queuedSet}
        onToggleQueue={onToggleQueue}
        projById={projById}
        vorById={vorById}
      />
    </>
  );

  return (
    <DraftShell
      tab={tab}
      onTabChange={setTab}
      teamName={team?.name ?? ""}
      initials={team?.initials ?? ""}
      color={team?.color ?? "#888888"}
      pickLabel={formatPick(overall, state.settings.teams)}
      isUser={isUser}
      isComplete={isComplete(state)}
      timer={tab !== "draft" && isUser && !isComplete(state) ? timerUi : null}
      statusLine={`R${round} · PICK ${overall} OF ${state.order.length}`}
    >
      <div className="mock-draft">
        {simMode && !isComplete(state) && (
          <button
            className="dev-sim-btn"
            title="Fill the whole board instantly and jump to the summary (?sim=1)"
            onClick={onSimulate}
          >
            ⚡ Simulate draft
          </button>
        )}
        {tab === "draft" && (
          // B6: Broadcast Desk — three columns (clock + roster + queue /
          // best available / round strip). The clock panel reuses the existing
          // OnTheClockBanner (and its preserved pause/undo/mute/timer/reveal
          // wiring) untouched; the app-bar timer is hidden on this tab so the
          // Desk owns the live clock.
          <div className="desk">
            <div className="desk-col desk-left">
              <OnTheClockBanner
                state={state}
                round={round}
                overall={overall}
                isUser={isUser}
                isComplete={isComplete(state)}
                paused={paused}
                picksAway={picksAway}
                urgent={urgent}
                muted={muted}
                onToggleMute={toggleMute}
                timerSec={timerSec}
                onTimerSecChange={setTimerSec}
                onTogglePause={() => setPaused((p) => !p)}
                onUndo={undoAndPause}
                onExit={onExit}
                timer={timerUi}
              />

              <MyQueue
                players={queuePlayers}
                canDraft={isUser && !revealing}
                onDraft={onDraft}
                onRemove={(id) =>
                  setQueueIds((ids) => ids.filter((x) => x !== id))
                }
                onOpenPlayer={(id) => setOpenPlayer(id)}
              />

              <MyRoster state={state} userTeamIndex={userTeamIndex} />
            </div>

            <div className="desk-col desk-center">
              {showNudge && nudge && (
                <StrategyNudge
                  copy={nudge}
                  onDismiss={() => setDismissedStrat(detected.strategy)}
                />
              )}
              {draftPoolBody}
            </div>

            <div className="desk-col desk-right">
              <RoundStrip state={state} round={round} />
            </div>
          </div>
        )}

        {tab === "players" && playersPoolBody}

        {tab === "board" && (
          <>
            {/* Wall / Locker Room toggle */}
            <div className="board-view-toggle">
              <button
                className={`bvt-pill${boardView === "wall" ? " active" : ""}`}
                onClick={() => setBoardView("wall")}
              >
                THE WALL
              </button>
              <button
                className={`bvt-pill${boardView === "locker" ? " active" : ""}`}
                onClick={() => setBoardView("locker")}
              >
                LOCKER ROOM
              </button>
            </div>

            {boardView === "wall" ? (
              <DraftBoardGrid
                state={state}
                onPickClick={(o) => setMenuFor(o)}
                timer={isUser ? timerUi : undefined}
                urgent={urgent}
              />
            ) : (
              <LockerRoom state={state} />
            )}
          </>
        )}

        {tab === "tv" && (
          <div className="tv-tab">
            <div className="tv-tab-bar">
              <button
                className="tv-open-btn"
                onClick={() =>
                  window.open(
                    location.href.split("#")[0] + "#tv",
                    "otc-tv",
                    "width=1280,height=720",
                  )
                }
                title="Open the cast view in a separate window"
              >
                ⧉ Open TV Window
              </button>
            </div>
            <TVStage snapshot={buildTvSnapshot(state)} />
          </div>
        )}

        <PickStrip
          state={state}
          userTeamIndex={userTeamIndex}
          onOpenPlayer={(id) => setOpenPlayer(id)}
          timer={isUser ? timerUi : undefined}
          urgent={urgent}
        />

        <PlayerPanel
          player={
            openPlayer
              ? (state.pool.find((p) => p.id === openPlayer) ?? null)
              : null
          }
          draftStatus={
            openPlayer
              ? playerDraftStatus(state, openPlayer)
              : { drafted: false }
          }
          proj={openPlayer ? projById[openPlayer] : undefined}
          vor={openPlayer ? vorById[openPlayer] : undefined}
          onClose={() => setOpenPlayer(null)}
        />

        {/* Missed-pick modal */}
        {missed && (
          <div className="missed-scrim">
            <div className="missed-modal">
              <h3>⏰ You missed your pick</h3>
              <p>
                Your clock ran out. Keep drafting, or let auto-draft finish for
                you?
              </p>
              <div className="missed-acts">
                <button className="ghost" onClick={() => setMissed(false)}>
                  Keep drafting
                </button>
                <button
                  className="primary"
                  onClick={() => {
                    setAutoOn(true);
                    setMissed(false);
                  }}
                >
                  Auto-draft the rest
                </button>
              </div>
              <div className="missed-count">
                Auto-drafts in {missedLeft}s if you don&apos;t choose…
              </div>
            </div>
          </div>
        )}

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
                <SearchPill
                  value={replaceSearch}
                  onChange={setReplaceSearch}
                  placeholder="Search players…"
                  autoFocus
                />
                <div className="pickmenu-list">
                  {availableByBoard(state)
                    .filter((p) =>
                      p.name
                        .toLowerCase()
                        .includes(replaceSearch.toLowerCase()),
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
    </DraftShell>
  );
}
