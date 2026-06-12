import { useEffect, useMemo, useRef, useState } from "react";
import type { MockState } from "../../lib/mock/types";
import type { Position } from "../../types";
import {
  availableByBoard,
  bestAvailableId,
  botPickId,
  currentTeamIndex,
  isComplete,
  teamRosterPositions,
} from "../../lib/mock/engine";
import { formatPick, picksUntilUser } from "../../lib/mock/board";
import { playPing } from "../../lib/sound";
import { SearchPill } from "../SearchPill";
import { PickStrip } from "./PickStrip";
import { DraftBoardGrid } from "./DraftBoardGrid";
import { OnTheClockBanner } from "./OnTheClockBanner";
import { StopwatchMark } from "./StopwatchMark";
import { PickPool, type PoolCol, POOL_COL_CAP } from "./PickPool";
import { PlayerPanel } from "./PlayerPanel";
import { DraftShell, type DraftTab } from "./DraftShell";
import { playerDraftStatus } from "../../lib/mock/playerDraftStatus";
import { MyQueue } from "./MyQueue";
import { toggleQueue, pendingQueue } from "../../lib/mock/queue";

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
  // B1: top-level draft-room tab (app-bar). Defaults to the working Draft view
  // so the clock + controls are visible on entry.
  const [tab, setTab] = useState<DraftTab>("draft");
  // B5: My Queue — ordered list of starred player ids. Drafted ones auto-drop
  // from the display via pendingQueue (derived at render, no effect needed).
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [openPlayer, setOpenPlayer] = useState<string | null>(null);
  const [extraCols, setExtraCols] = useState<PoolCol[]>(["bye"]);
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [autoOn, setAutoOn] = useState(!!state.settings.autoDraft);
  const [missed, setMissed] = useState(false);
  const [missedLeft, setMissedLeft] = useState(25);
  const promptedRef = useRef(false);
  const [menuFor, setMenuFor] = useState<number | null>(null); // pick popover
  const [replaceSearch, setReplaceSearch] = useState("");
  const [timerSec, setTimerSec] = useState<number | null>(20); // null = Off
  const [remaining, setRemaining] = useState(20);
  // The "on the clock" reveal locks the clock + Draft for a beat so the
  // typewriter + glow can play before the user can act.
  const [revealing, setRevealing] = useState(false);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem("otc:muted") === "1";
    } catch {
      return false;
    }
  });
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const onClock = currentTeamIndex(state);
  const team = state.teams[onClock];
  const isUser = onClock === userTeamIndex && !isComplete(state);
  const overall = state.picks.length + 1;
  const round = Math.floor((overall - 1) / state.settings.teams) + 1;
  const picksAway = picksUntilUser(state, userTeamIndex);
  const toggleMute = () =>
    setMuted((m) => {
      const next = !m;
      try {
        localStorage.setItem("otc:muted", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });

  // Going on the clock: ping (unless muted) and hold a 1.5s reveal during which
  // the timer is idle and Draft is locked. Re-fires for each new user pick.
  const REVEAL_MS = 1500;
  useEffect(() => {
    if (!isUser) {
      setRevealing(false);
      return;
    }
    setRevealing(true);
    if (!mutedRef.current) playPing();
    const t = setTimeout(() => setRevealing(false), REVEAL_MS);
    return () => clearTimeout(t);
  }, [isUser, overall]);

  // Reset the clock to full on a new pick, a duration change, or resuming from a
  // pause. The pause case only reaches the user's clock via undo-on-your-turn
  // (which pauses); a fresh full clock there is intended, not a resume mid-count.
  useEffect(() => {
    if (timerSec != null) setRemaining(timerSec);
  }, [overall, timerSec, paused]);

  // Countdown + auto-pick (user's live, unpaused turn only). Held during the
  // reveal so the clock doesn't start until the animation finishes.
  useEffect(() => {
    if (timerSec == null || paused || !isUser || revealing) return;
    if (remaining <= 0) {
      const id = bestAvailableId(state);
      if (id) onDraft(id);
      // Show missed-pick popup once per draft session (only when not auto-drafting)
      if (!autoOn && !promptedRef.current) {
        promptedRef.current = true;
        setMissed(true);
      }
      return;
    }
    const t = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timerSec, paused, isUser, revealing, remaining, state, onDraft, autoOn]);

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

  // Auto-draft: when enabled and it's the user's live, unpaused, non-revealing,
  // non-complete turn, pick the best available after BOT_DELAY (mirrors bot guards).
  useEffect(() => {
    if (!autoOn || !isUser || paused || revealing || isComplete(state)) return;
    const id = bestAvailableId(state);
    if (!id) return;
    const t = setTimeout(() => onDraft(id), BOT_DELAY);
    return () => clearTimeout(t);
  }, [autoOn, isUser, paused, revealing, state, onDraft]);

  // Missed-pick modal countdown: decrement missedLeft each second while modal is open;
  // at 0, activate auto-draft and close the modal.
  useEffect(() => {
    if (!missed) {
      setMissedLeft(25);
      return;
    }
    if (missedLeft <= 0) {
      setAutoOn(true);
      setMissed(false);
      return;
    }
    const t = setTimeout(() => setMissedLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [missed, missedLeft]);

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
  }, [queueIds, state.pool, state.draftedIds]);
  const onToggleQueue = (id: string) =>
    setQueueIds((ids) => toggleQueue(ids, id));

  const myPositions = teamRosterPositions(state, userTeamIndex);

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

  // Final-seconds alert: the stopwatch sweeps and the wordmark re-pulses.
  const urgent = isUser && !revealing && timerSec != null && remaining <= 5;
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
                const comingSoon = c === "proj" || c === "vor";
                return (
                  <button
                    key={c}
                    className={on ? "on" : ""}
                    disabled={
                      comingSoon || (!on && extraCols.length >= POOL_COL_CAP)
                    }
                    title={comingSoon ? "Coming soon" : undefined}
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
        onToggleCol={toggleCol}
        onDraft={onDraft}
        onOpenPlayer={(id) => setOpenPlayer(id)}
        queuedIds={queuedSet}
        onToggleQueue={onToggleQueue}
      />
    </>
  );

  // PLAYERS tab: full pool including drafted players, dimmed with pick status.
  const playersPoolBody = (
    <>
      {filterBar}
      <PickPool
        players={fullPool}
        canDraft={isUser && !revealing}
        overall={overall}
        extraCols={extraCols}
        onToggleCol={toggleCol}
        onDraft={onDraft}
        onOpenPlayer={(id) => setOpenPlayer(id)}
        draftStatusOf={draftStatusOf}
        queuedIds={queuedSet}
        onToggleQueue={onToggleQueue}
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
      timer={isUser && !isComplete(state) ? timerUi : null}
      statusLine={`R${round} · PICK ${overall} OF ${state.order.length}`}
    >
      <div className="mock-draft">
        {tab === "draft" && (
          <>
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
            />

            <div className="mock-myroster">
              {myPositions.length === 0 ? (
                <span className="mock-myroster-empty">
                  Your picks will appear here
                </span>
              ) : (
                state.picks
                  .filter((pk) => pk.teamIndex === userTeamIndex)
                  .map((pk) => {
                    const pl = state.pool.find((p) => p.id === pk.playerId);
                    if (!pl) return null;
                    return (
                      <span
                        key={pk.overall}
                        className={`mock-roster-chip pos-${pl.position}`}
                      >
                        <span className="mrc-pos">{pl.position}</span>
                        <span className="mrc-name">
                          {pl.name.split(" ").slice(-1)[0]}
                        </span>
                      </span>
                    );
                  })
              )}
            </div>

            <MyQueue
              players={queuePlayers}
              canDraft={isUser && !revealing}
              onDraft={onDraft}
              onRemove={(id) =>
                setQueueIds((ids) => ids.filter((x) => x !== id))
              }
              onOpenPlayer={(id) => setOpenPlayer(id)}
            />

            {draftPoolBody}
          </>
        )}

        {tab === "players" && playersPoolBody}

        {tab === "board" && (
          <DraftBoardGrid
            state={state}
            onPickClick={(o) => setMenuFor(o)}
            timer={isUser ? timerUi : undefined}
          />
        )}

        {tab === "tv" && (
          <div className="draft-tv-placeholder">
            <span className="ppx-soon">TV Mode · Coming soon</span>
            <p>
              A passive, animated &ldquo;cast&rdquo; view for in-person draft
              parties — split-flap board, latest-pick splash, and a live ticker.
              Landing in a later update.
            </p>
          </div>
        )}

        <PickStrip
          state={state}
          userTeamIndex={userTeamIndex}
          onOpenPlayer={(id) => setOpenPlayer(id)}
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
