import { useEffect, useRef } from "react";
import type { MockState } from "../../lib/mock/types";
import {
  buildTvSnapshot,
  announceFor,
  TV_CHANNEL,
  type TvMessage,
} from "../../lib/mock/tvSnapshot";

// B9: broadcast a compact TV snapshot to any open "cast" window (the #tv route)
// over a BroadcastChannel. Read-only mirror — additive, never touches the draft
// engine.
//
// The channel is opened ONCE (stable across the draft) so a fresh TV window's
// one-shot "request" never races a channel teardown; a separate effect posts
// the latest snapshot on every state change. The request handler reads the
// current state via a ref so its reply is never stale.
export function useTvBroadcast(state: MockState, autoOn = false): void {
  const chanRef = useRef<BroadcastChannel | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(TV_CHANNEL);
    chanRef.current = ch;
    ch.onmessage = (e: MessageEvent<TvMessage>) => {
      if (e.data.type === "request") {
        ch.postMessage({
          type: "snapshot",
          snapshot: buildTvSnapshot(stateRef.current),
        } satisfies TvMessage);
      }
    };
    return () => {
      ch.close();
      chanRef.current = null;
    };
  }, []);

  // Pick *events* ride alongside the state mirror. announceFor decides whether
  // this state change was real forward progress (see its comment) — undo,
  // rewind, replace and simulate-to-end all resolve to null, so the TV window
  // never announces them.
  //
  // Announce is posted BEFORE the snapshot so the TV window can start speaking
  // and then flip the name, which is the intended draft-room choreography.
  const prevCount = useRef(state.picks.length);
  useEffect(() => {
    const announce = announceFor(state, prevCount.current, autoOn);
    prevCount.current = state.picks.length;
    if (announce) {
      chanRef.current?.postMessage({
        type: "announce",
        announce,
      } satisfies TvMessage);
    }
    chanRef.current?.postMessage({
      type: "snapshot",
      snapshot: buildTvSnapshot(state),
    } satisfies TvMessage);
  }, [state, autoOn]);
}
