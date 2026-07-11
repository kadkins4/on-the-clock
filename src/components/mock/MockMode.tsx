import { useCallback, useEffect, useState } from "react";
import type { League } from "../../types";
import type { MockSettings, MockState } from "../../lib/mock/types";
import {
  createMock,
  draftPlayer,
  botPickId,
  undoLastPick,
  replacePick,
  rewindTo,
  isComplete,
} from "../../lib/mock/engine";
import { mockSummary } from "../../lib/mock/summary";
import { unlockAudio } from "../../lib/sound";
import { MockSetup } from "./MockSetup";
import { MockDraft } from "./MockDraft";
import { MockSummary } from "./MockSummary";

interface Props {
  league: League;
  onExit: () => void;
  onSetValueFlags: (
    listId: string,
    valueFlags: { enabled: boolean; threshold: number | null },
  ) => void;
}

type Phase = "setup" | "draft" | "summary";

export function MockMode({ league, onExit, onSetValueFlags }: Props) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [state, setState] = useState<MockState | null>(null);
  const [userSlot, setUserSlot] = useState(1);

  const start = useCallback(
    (settings: Omit<MockSettings, "rounds"> & { rounds: number }) => {
      unlockAudio(); // prime audio on this gesture so the clock bell can play
      setUserSlot(settings.userSlot);
      setState(createMock(league, settings, Date.now() >>> 0));
      setPhase("draft");
    },
    [league],
  );

  const userDraft = useCallback((id: string) => {
    setState((m) => (m ? draftPlayer(m, id) : m));
  }, []);

  const botTick = useCallback(() => {
    setState((m) => (m ? draftPlayer(m, botPickId(m)) : m));
  }, []);

  const undo = useCallback(() => {
    setState((m) => (m ? undoLastPick(m) : m));
  }, []);

  const replace = useCallback((overall: number, id: string) => {
    setState((m) => (m ? replacePick(m, overall, id) : m));
  }, []);

  const rewind = useCallback((overall: number) => {
    setState((m) => (m ? rewindTo(m, overall) : m));
  }, []);

  // advance to summary once the board fills — intentional phase transition
  // driven by the draft reaching completion, not a render loop.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state && isComplete(state) && phase === "draft") setPhase("summary");
  }, [state, phase]);

  if (phase === "setup") {
    return (
      <MockSetup
        league={league}
        onStart={start}
        onCancel={onExit}
        onSetValueFlags={onSetValueFlags}
      />
    );
  }
  if (phase === "draft" && state) {
    return (
      <MockDraft
        state={state}
        userTeamIndex={userSlot - 1}
        onDraft={userDraft}
        onBotTick={botTick}
        onUndo={undo}
        onExit={onExit}
        onReplacePick={replace}
        onRewindTo={rewind}
      />
    );
  }
  if (phase === "summary" && state) {
    return (
      <MockSummary
        summary={mockSummary(state, userSlot - 1)}
        teams={state.settings.teams}
        teamIdentities={state.teams}
        onRestart={() => setPhase("setup")}
        onExit={onExit}
      />
    );
  }
  return null;
}
