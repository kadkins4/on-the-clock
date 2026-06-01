import { useCallback, useEffect, useState } from "react";
import type { League } from "../../types";
import type { MockSettings, MockState } from "../../lib/mock/types";
import {
  createMock,
  draftPlayer,
  botPickId,
  undoLastPick,
  isComplete,
} from "../../lib/mock/engine";
import { mockSummary } from "../../lib/mock/summary";
import { MockSetup } from "./MockSetup";
import { MockDraft } from "./MockDraft";
import { MockSummary } from "./MockSummary";

interface Props {
  league: League;
  onExit: () => void;
}

type Phase = "setup" | "draft" | "summary";

export function MockMode({ league, onExit }: Props) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [state, setState] = useState<MockState | null>(null);
  const [userSlot, setUserSlot] = useState(1);

  const start = useCallback(
    (settings: Omit<MockSettings, "rounds">) => {
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

  // advance to summary once the board fills
  useEffect(() => {
    if (state && isComplete(state) && phase === "draft") setPhase("summary");
  }, [state, phase]);

  if (phase === "setup") {
    return <MockSetup league={league} onStart={start} onCancel={onExit} />;
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
      />
    );
  }
  if (phase === "summary" && state) {
    return (
      <MockSummary
        summary={mockSummary(state, userSlot - 1)}
        onRestart={() => setPhase("setup")}
        onExit={onExit}
      />
    );
  }
  return null;
}
