import { useState } from "react";
import type { League } from "../../types";
import type { MockSettings } from "../../lib/mock/types";
import { valueFlagsEnabled } from "../../lib/league";

interface Props {
  league: League;
  onStart: (settings: Omit<MockSettings, "rounds">) => void;
  onCancel: () => void;
  onSetValueFlags: (
    listId: string,
    valueFlags: { enabled: boolean; threshold: number | null },
  ) => void;
}

export function MockSetup({
  league,
  onStart,
  onCancel,
  onSetValueFlags,
}: Props) {
  const [teams, setTeams] = useState(league.teams);
  const [userSlot, setUserSlot] = useState(1);
  const [thirdRoundReversal, setThirdRoundReversal] = useState(false);
  const defaultList =
    league.tierLists.find((t) => t.id === league.defaultTierListId) ??
    league.tierLists[0];
  const [vfEnabled, setVfEnabled] = useState(valueFlagsEnabled(defaultList));
  const [vfThreshold, setVfThreshold] = useState<number | null>(
    defaultList.valueFlags?.threshold ?? null,
  );

  return (
    <div className="mock-setup">
      <h2>Mock draft — {league.name}</h2>
      <p className="mock-sub">
        Scoring: {league.scoring.toUpperCase()} · bots use this league's roster
        settings
      </p>
      <label>
        Teams{" "}
        <select
          value={teams}
          onChange={(e) => {
            const t = Number(e.target.value);
            setTeams(t);
            if (userSlot > t) setUserSlot(t);
          }}
        >
          {Array.from({ length: 9 }, (_, i) => i + 8).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label>
        Your slot{" "}
        <select
          value={userSlot}
          onChange={(e) => setUserSlot(Number(e.target.value))}
        >
          {Array.from({ length: teams }, (_, i) => i + 1).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={thirdRoundReversal}
          onChange={(e) => setThirdRoundReversal(e.target.checked)}
        />{" "}
        3rd-round reversal
      </label>
      <label>
        <input
          type="checkbox"
          checked={vfEnabled}
          onChange={(e) => setVfEnabled(e.target.checked)}
        />{" "}
        Highlight reaches &amp; values
      </label>
      <label>
        Threshold (picks off ADP/rank){" "}
        <input
          type="number"
          min={1}
          placeholder={`${teams + 2}`}
          value={vfThreshold ?? ""}
          disabled={!vfEnabled}
          onChange={(e) =>
            setVfThreshold(
              e.target.value === "" ? null : Number(e.target.value),
            )
          }
        />
      </label>
      <div className="mock-actions">
        <button
          onClick={() => {
            onSetValueFlags(defaultList.id, {
              enabled: vfEnabled,
              threshold: vfThreshold,
            });
            onStart({
              teams,
              userSlot,
              thirdRoundReversal,
              valueThreshold: vfThreshold ?? teams + 2,
              valueFlagsEnabled: vfEnabled,
            });
          }}
        >
          Start mock
        </button>
        <button className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
