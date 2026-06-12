import { useEffect, useState } from "react";
import type { TvSnapshot, TvMessage } from "../../lib/mock/tvSnapshot";
import { TV_CHANNEL } from "../../lib/mock/tvSnapshot";
import { TVStage } from "./TVStage";

export function TvWindow() {
  const [snapshot, setSnapshot] = useState<TvSnapshot | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;

    const ch = new BroadcastChannel(TV_CHANNEL);

    ch.onmessage = (e: MessageEvent<TvMessage>) => {
      if (e.data.type === "snapshot") {
        setSnapshot(e.data.snapshot);
      }
    };

    // Ask the main window for the current snapshot
    const req: TvMessage = { type: "request" };
    ch.postMessage(req);

    return () => ch.close();
  }, []);

  if (!snapshot) {
    return (
      <div className="tv-window-waiting">
        <span className="tv-window-waiting-text">
          Waiting for the draft&hellip;
        </span>
      </div>
    );
  }

  return (
    <div className="tv-window">
      <TVStage snapshot={snapshot} />
    </div>
  );
}
