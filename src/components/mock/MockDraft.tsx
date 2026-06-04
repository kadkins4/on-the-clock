import { useEffect, useMemo, useRef, useState } from "react";
import type { MockState } from "../../lib/mock/types";
import type { Position } from "../../types";
import {
  available,
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
  const [poolTab, setPoolTab] = useState<"players" | "queue" | "board">(
    "players",
  );
  const [openPlayer, setOpenPlayer] = useState<string | null>(null);
  const [extraCols, setExtraCols] = useState<PoolCol[]>(["bye"]);
  const [paused, setPaused] = useState(false);
  const [menuFor, setMenuFor] = useState<number | null>(null); // pick popover
  const [replaceSearch, setReplaceSearch] = useState("");
  const [timerSec, setTimerSec] = useState<number | null>(60); // null = Off
  const [remaining, setRemaining] = useState(60);
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
      return;
    }
    const t = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timerSec, paused, isUser, revealing, remaining, state, onDraft]);

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

  return (
    <div className="mock-draft">
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

      <div className="pool-tabs">
        <button
          className={poolTab === "players" ? "on" : ""}
          onClick={() => setPoolTab("players")}
        >
          Players
        </button>
        <button
          className={poolTab === "queue" ? "on" : ""}
          onClick={() => setPoolTab("queue")}
        >
          Queue
        </button>
        <button
          className={poolTab === "board" ? "on" : ""}
          onClick={() => setPoolTab("board")}
        >
          Draft Board
        </button>
      </div>

      {poolTab === "players" && (
        <>
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

          <PickPool
            players={avail.slice(0, 100)}
            canDraft={isUser && !revealing}
            overall={overall}
            extraCols={extraCols}
            onToggleCol={toggleCol}
            onDraft={onDraft}
            onOpenPlayer={(id) => setOpenPlayer(id)}
          />
        </>
      )}

      {poolTab === "queue" && (
        <div className="queue-soon">
          <span className="ppx-soon">Queue · Coming soon</span>
          <p>
            Add players to a queue and drag them up and down to plan your picks.
            Landing soon.
          </p>
        </div>
      )}

      {poolTab === "board" && (
        <DraftBoardGrid
          state={state}
          onPickClick={(o) => setMenuFor(o)}
          timer={isUser ? timerUi : undefined}
        />
      )}
      <PickStrip state={state} onPickClick={(o) => setMenuFor(o)} />

      <PlayerPanel
        player={
          openPlayer
            ? (state.pool.find((p) => p.id === openPlayer) ?? null)
            : null
        }
        onClose={() => setOpenPlayer(null)}
      />

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
