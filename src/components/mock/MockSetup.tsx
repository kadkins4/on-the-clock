import type { League, Scoring } from "../../types";
import type { MockSettings } from "../../lib/mock/types";
import { defaultValueThreshold } from "../../lib/draftValue";
import { StopwatchMark } from "./StopwatchMark";
import {
  useMockSetupForm,
  type LobbyFormat,
  type RosterKey,
} from "./useMockSetupForm";

interface Props {
  league: League;
  onStart: (
    settings: Omit<MockSettings, "rounds"> & { rounds: number },
  ) => void;
  onCancel: () => void;
  onSetValueFlags: (
    listId: string,
    valueFlags: { enabled: boolean; threshold: number | null },
  ) => void;
}

const DRAFT_FORMATS: { value: LobbyFormat; label: string; soon?: boolean }[] = [
  { value: "snake", label: "Snake" },
  { value: "linear", label: "Linear" },
  { value: "auction", label: "Auction", soon: true },
];

const SCORINGS: { value: Scoring; label: string }[] = [
  { value: "ppr", label: "PPR" },
  { value: "half", label: "Half" },
  { value: "standard", label: "Standard" },
];

// Roster ± steppers (SUPERFLEX is intentionally a "coming soon" advanced row).
const ROSTER_FIELDS: {
  key: RosterKey;
  label: string;
  pos?: string;
  max: number;
}[] = [
  { key: "QB", label: "QB", pos: "QB", max: 3 },
  { key: "RB", label: "RB", pos: "RB", max: 5 },
  { key: "WR", label: "WR", pos: "WR", max: 5 },
  { key: "TE", label: "TE", pos: "TE", max: 3 },
  { key: "FLEX", label: "FLEX", max: 4 },
  { key: "K", label: "K", pos: "K", max: 2 },
  { key: "DST", label: "DST", pos: "DST", max: 2 },
  { key: "bench", label: "BN", max: 12 },
];

function Stepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  label: string;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className="ms-stepper" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(clamp(value - 1))}
      >
        −
      </button>
      <span className="ms-stepper-val">{value}</span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => onChange(clamp(value + 1))}
      >
        +
      </button>
    </div>
  );
}

function Switch({
  on,
  onToggle,
  disabled,
  label,
}: {
  on: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className={`ms-switch${on ? " on" : ""}`}
      onClick={onToggle}
    />
  );
}

function ComingSoonRow({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="ms-switch-row is-soon">
      <div className="ms-row-meta">
        <div className="ms-row-title">
          {title}
          <span className="ms-soon-tag">Soon</span>
        </div>
        <div className="ms-row-desc">{desc}</div>
      </div>
      <Switch on={false} disabled label={`${title} (coming soon)`} />
    </div>
  );
}

export function MockSetup({
  league,
  onStart,
  onCancel,
  onSetValueFlags,
}: Props) {
  const f = useMockSetupForm(league);

  const start = () => {
    onSetValueFlags(f.defaultListId, f.getValueFlags());
    onStart(f.getSettings());
  };

  return (
    <div className="ms-card">
      <header className="ms-head">
        <StopwatchMark />
        <div>
          <div className="ms-eyebrow">New Mock Draft</div>
          <h2 className="ms-title">{league.name}</h2>
        </div>
      </header>

      {/* Draft format */}
      <div className="ms-block">
        <span className="ms-label">Draft format</span>
        <div className="ms-seg" role="group" aria-label="Draft format">
          {DRAFT_FORMATS.map((opt) => (
            <button
              type="button"
              key={opt.value}
              className={`${opt.soon ? "ms-seg-soon" : ""}${
                f.format === opt.value ? " on" : ""
              }`}
              aria-pressed={f.format === opt.value}
              onClick={() => f.setFormat(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {f.format === "auction" && (
          <p className="ms-seg-note">
            Auction isn&rsquo;t available yet &mdash; Snake will run this mock.
          </p>
        )}
      </div>

      {/* Scoring */}
      <div className="ms-block">
        <span className="ms-label">Scoring</span>
        <div className="ms-seg" role="group" aria-label="Scoring">
          {SCORINGS.map((opt) => (
            <button
              type="button"
              key={opt.value}
              className={f.scoring === opt.value ? "on" : ""}
              aria-pressed={f.scoring === opt.value}
              onClick={() => f.setScoring(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Teams + Rounds */}
      <div className="ms-block ms-field-row">
        <div className="ms-field-col">
          <span className="ms-label">Teams</span>
          <Stepper
            label="Teams"
            value={f.teams}
            min={4}
            max={16}
            onChange={f.setTeams}
          />
        </div>
        <div className="ms-field-col">
          <span className="ms-label">Rounds</span>
          <Stepper
            label="Rounds"
            value={f.rounds}
            min={1}
            max={25}
            onChange={f.setRounds}
          />
        </div>
      </div>

      {/* Your slot */}
      <div className="ms-block">
        <span className="ms-label">Your draft slot</span>
        <div className="ms-slotboard" role="group" aria-label="Your draft slot">
          {Array.from({ length: f.teams }, (_, i) => i + 1).map((s) => (
            <button
              type="button"
              key={s}
              className={`ms-slot${f.userSlot === s ? " sel" : ""}`}
              aria-pressed={f.userSlot === s}
              aria-label={`Draft slot ${s}${f.userSlot === s ? " (you)" : ""}`}
              onClick={() => f.setUserSlot(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced */}
      <button
        type="button"
        className={`ms-disclosure${f.advancedOpen ? " open" : ""}`}
        aria-expanded={f.advancedOpen}
        onClick={() => f.setAdvancedOpen(!f.advancedOpen)}
      >
        <span className="ms-chev">▶</span> Advanced options
      </button>

      {f.advancedOpen && (
        <div className="ms-adv-body">
          {/* 3rd-round reversal is a snake-only concept — hidden for linear. */}
          {f.format !== "linear" && (
            <div className="ms-switch-row">
              <div className="ms-row-meta">
                <div className="ms-row-title">3rd-round reversal</div>
                <div className="ms-row-desc">
                  Reverse the snake again after round 2.
                </div>
              </div>
              <Switch
                label="3rd-round reversal"
                on={f.thirdRoundReversal}
                onToggle={() => f.setThirdRoundReversal(!f.thirdRoundReversal)}
              />
            </div>
          )}

          <div className="ms-switch-row">
            <div className="ms-row-meta">
              <div className="ms-row-title">Auto-draft my picks</div>
              <div className="ms-row-desc">
                Let the engine pick best-available for you.
              </div>
            </div>
            <Switch
              label="Auto-draft my picks"
              on={f.autoDraft}
              onToggle={() => f.setAutoDraft(!f.autoDraft)}
            />
          </div>

          <div className="ms-switch-row">
            <div className="ms-row-meta">
              <div className="ms-row-title">Bot personalities</div>
              <div className="ms-row-desc">
                Bots draft with distinct strategies (Zero RB, Hero RB…). Off =
                straight best-available.
              </div>
            </div>
            <Switch
              label="Bot personalities"
              on={f.botPersonalities}
              onToggle={() => f.setBotPersonalities(!f.botPersonalities)}
            />
          </div>

          <div className="ms-switch-row">
            <div className="ms-row-meta">
              <div className="ms-row-title">Highlight reaches &amp; values</div>
              <div className="ms-row-desc">
                Flag picks that beat or miss ADP.
              </div>
            </div>
            <Switch
              label="Highlight reaches and values"
              on={f.vfEnabled}
              onToggle={() => f.setVfEnabled(!f.vfEnabled)}
            />
          </div>

          {f.vfEnabled && (
            <div className="ms-switch-row">
              <div className="ms-row-meta">
                <div className="ms-row-title">Value threshold</div>
                <div className="ms-row-desc">
                  Picks off ADP / rank before flagging.
                </div>
              </div>
              <input
                className="ms-num"
                type="number"
                min={1}
                aria-label="Value threshold"
                placeholder={`${defaultValueThreshold(f.teams)}`}
                value={f.vfThreshold ?? ""}
                onChange={(e) =>
                  f.setVfThreshold(
                    e.target.value === ""
                      ? null
                      : Math.max(1, Math.round(Number(e.target.value))),
                  )
                }
              />
            </div>
          )}

          <ComingSoonRow
            title="Super Flex"
            desc="Adds a QB-eligible flex slot."
          />
          <ComingSoonRow
            title="TE Premium"
            desc="Extra points per tight-end reception."
          />

          {/* Roster spots */}
          <div className="ms-roster">
            <span className="ms-label">Roster spots</span>
            <div className="ms-rgrid">
              {ROSTER_FIELDS.map((field) => (
                <div className="ms-rcell" key={field.key}>
                  <span
                    className={`ms-rpos${field.pos ? ` ms-pos-${field.pos}` : ""}`}
                  >
                    {field.label}
                  </span>
                  <div className="ms-ministep">
                    <button
                      type="button"
                      aria-label={`Decrease ${field.label}`}
                      onClick={() =>
                        f.setRosterCount(field.key, f.roster[field.key] - 1)
                      }
                    >
                      −
                    </button>
                    <span>{f.roster[field.key]}</span>
                    <button
                      type="button"
                      aria-label={`Increase ${field.label}`}
                      onClick={() =>
                        f.setRosterCount(
                          field.key,
                          Math.min(field.max, f.roster[field.key] + 1),
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bot personalities teaser */}
          <div className="ms-soon">
            <div className="ms-soon-head">
              <span className="ms-soon-ic">🤖</span>
              <span className="ms-soon-t">Bot Personalities</span>
              <span className="ms-soon-badge">Coming soon</span>
            </div>
            <p className="ms-soon-note">
              Give each bot a drafting archetype &mdash; Zero-RB, Hero-RB,
              Homer, Value Hawk &mdash; randomized across seats or assigned per
              seat.
            </p>
          </div>
        </div>
      )}

      <div className="ms-actions">
        <button type="button" className="ms-start" onClick={start}>
          Start Mock
        </button>
        <button type="button" className="ms-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
