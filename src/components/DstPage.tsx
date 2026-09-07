import { useState } from "react";
import defenseData from "../data/defense-data.json";
import "./DstPage.css";

// Full-page Defenses (DST) board. Ported from the standalone board in
// fantasy-draft-helper; ships its own dataset (defense-data.json) because the
// app's DST player objects carry no SoS / schedule / turnover detail. Reached
// from the "DST Board" toggle in the Toolbar's position-filter row.

interface Game {
  wk: number;
  opp: string;
  homeAway: string;
  oppOffenseRank: number;
  oppOffenseTier: string;
}
interface Defense {
  team: string;
  name: string;
  dstRank: number;
  dstProjPoints: number;
  projTakeaways: number;
  takeawaysNote: string;
  projPointsAgainst: number;
  projPointsFor: number;
  pointsNote: string;
  sched: Game[];
  sosFull: number;
  sos13: number;
  bye: number;
  vegFullRank: number;
  veg13Rank: number;
  dsFullRank: number;
  ds13Rank: number;
}
interface DefenseData {
  meta: {
    season: number;
    targetCount: number;
    updated: string;
    offenseSource: string;
    sources: string;
  };
  teams: Defense[];
}

const data: DefenseData = defenseData;
const { meta, teams } = data;

// Numeric columns that can be sorted (label + the key to sort by).
type SortKey = keyof Pick<
  Defense,
  | "dstRank"
  | "dstProjPoints"
  | "projTakeaways"
  | "projPointsFor"
  | "projPointsAgainst"
  | "vegFullRank"
  | "dsFullRank"
  | "veg13Rank"
  | "ds13Rank"
>;

function tierClass(tier: string): string {
  const t = (tier || "").toLowerCase();
  if (t.startsWith("weak")) return "off-weak";
  if (t.startsWith("avg") || t.startsWith("average")) return "off-avg";
  if (t.startsWith("elite")) return "off-elite";
  if (t.startsWith("good") || t.startsWith("strong")) return "off-good";
  return "off-avg";
}
// SoS shown as a rank where 1 = easiest. Low rank = soft schedule (green).
function rankClass(r: number | null | undefined): string {
  if (r == null) return "";
  if (r <= 10) return "easy";
  if (r <= 22) return "med";
  return "hard";
}

function OppChip({ s }: { s: Game }) {
  return (
    <span className={`dst-opp ${tierClass(s.oppOffenseTier)}`}>
      <span className="dst-wk">WK {s.wk}</span>
      <span className="dst-m">
        <span className="dst-ha">{s.homeAway || ""}</span>
        {s.opp}
      </span>
      <span className="dst-tier">{(s.oppOffenseTier || "").toUpperCase()}</span>
    </span>
  );
}

function SosCell({
  rank,
  grp,
  title,
}: {
  rank: number | null | undefined;
  grp?: boolean;
  title?: string;
}) {
  return (
    <td
      className={`dst-sos${grp ? " dst-grp" : ""} ${rankClass(rank)}`}
      title={title}
    >
      {rank ?? "—"}
    </td>
  );
}

interface HeadProps {
  label: string;
  sortByKey?: SortKey;
  grp?: boolean;
  title?: string;
  num?: boolean;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
}
function Th({
  label,
  sortByKey,
  grp,
  title,
  num,
  sortKey,
  sortDir,
  onSort,
}: HeadProps) {
  const sortable = sortByKey != null;
  const active = sortable && sortByKey === sortKey;
  const cls = [
    num ? "dst-num" : "",
    grp ? "dst-grp" : "",
    sortable ? "dst-sortable" : "",
    active ? "dst-sorted" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <th
      className={cls || undefined}
      title={title}
      onClick={sortByKey ? () => onSort(sortByKey) : undefined}
    >
      {label}
      {active && (
        <span className="dst-sort-arrow">
          {sortDir === "desc" ? " ▼" : " ▲"}
        </span>
      )}
    </th>
  );
}

export function DstPage({ onBack }: { onBack: () => void }) {
  const [sortKey, setSortKey] = useState<SortKey>("dstRank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const list = [...teams].sort((a, b) => {
    const an = a[sortKey] ?? -Infinity;
    const bn = b[sortKey] ?? -Infinity;
    return sortDir === "desc" ? bn - an : an - bn;
  });

  const thShared = { sortKey, sortDir, onSort };

  return (
    <main className="dst-page">
      <button type="button" className="otc-navlink dst-back" onClick={onBack}>
        ← Back to board
      </button>

      <div className="dst-head">
        <h1>Defenses (DST)</h1>
        <span className="dst-sub">
          {meta.season} season · data {meta.updated}
        </span>
      </div>

      <div className="dst-controls">
        <span className="dst-label">
          Click a header to sort, click again to reverse. SoS: 1 = easiest.
        </span>
        <div className="dst-legend">
          <span>
            <span
              className="dst-dot"
              style={{ background: "var(--live-green)" }}
            />
            weak offense (good)
          </span>
          <span>
            <span
              className="dst-dot"
              style={{ background: "var(--your-gold)" }}
            />
            average
          </span>
          <span>
            <span
              className="dst-dot"
              style={{ background: "var(--urgent-red)" }}
            />
            strong (tough)
          </span>
        </div>
      </div>

      <div className="dst-panel">
        <div className="dst-tablewrap">
          <table>
            <thead>
              <tr>
                <Th
                  label="Rk"
                  sortByKey="dstRank"
                  title="Consensus 2026 DST rank (lower = stronger)"
                  {...thShared}
                />
                <Th label="Team" {...thShared} />
                <Th
                  label="DST proj"
                  sortByKey="dstProjPoints"
                  num
                  {...thShared}
                />
                <Th
                  label="Proj TO"
                  sortByKey="projTakeaways"
                  num
                  {...thShared}
                />
                <Th
                  label="Proj PF"
                  sortByKey="projPointsFor"
                  num
                  {...thShared}
                />
                <Th
                  label="Proj PA"
                  sortByKey="projPointsAgainst"
                  num
                  {...thShared}
                />
                <Th
                  label="Veg full"
                  sortByKey="vegFullRank"
                  num
                  grp
                  title="Vegas SoS, full season — our rank of avg opponent offense (Vegas implied totals). 1 = easiest."
                  {...thShared}
                />
                <Th
                  label="DS full"
                  sortByKey="dsFullRank"
                  num
                  title="Draft Sharks DST SoS, full season. 1 = easiest."
                  {...thShared}
                />
                <Th
                  label="Veg 1-3"
                  sortByKey="veg13Rank"
                  num
                  grp
                  title="Vegas SoS, Weeks 1-3. 1 = easiest."
                  {...thShared}
                />
                <Th
                  label="DS 1-3"
                  sortByKey="ds13Rank"
                  num
                  title="Draft Sharks DST SoS, Weeks 1-3. 1 = easiest."
                  {...thShared}
                />
                <Th label="First 3 opponents" grp {...thShared} />
              </tr>
            </thead>
            <tbody>
              {list.map((d) => {
                const target = d.dstRank <= meta.targetCount;
                const toStar = (d.takeawaysNote || "").includes("actual") ? (
                  <span className="dst-note">*</span>
                ) : null;
                return (
                  <tr
                    key={d.team}
                    className={target ? "dst-tier-target" : undefined}
                  >
                    <td className="dst-rank">{d.dstRank}</td>
                    <td>
                      <div className="dst-team-cell">
                        <span className="dst-team">
                          {d.name}
                          <span className="dst-abbr">{d.team}</span>
                          {target && <span className="dst-targetflag">★</span>}
                        </span>
                        <span className="dst-bye">BYE {d.bye}</span>
                      </div>
                    </td>
                    <td className="dst-num">{d.dstProjPoints}</td>
                    <td className="dst-num">
                      {d.projTakeaways}
                      {toStar}
                    </td>
                    <td className="dst-num">{d.projPointsFor}</td>
                    <td className="dst-num">{d.projPointsAgainst}</td>
                    <SosCell
                      rank={d.vegFullRank}
                      grp
                      title={`Vegas avg opp offense rank ${d.sosFull}`}
                    />
                    <SosCell rank={d.dsFullRank} />
                    <SosCell
                      rank={d.veg13Rank}
                      grp
                      title={`Vegas avg opp offense rank ${d.sos13}`}
                    />
                    <SosCell rank={d.ds13Rank} />
                    <td className="dst-grp">
                      <div className="dst-opps">
                        {d.sched.map((s) => (
                          <OppChip key={s.wk} s={s} />
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="dst-footnote">
        <b>Reading it:</b> ★ = target tier (top {meta.targetCount}).{" "}
        <b>SoS columns are ranks, 1 = easiest</b> (weakest offenses faced, best
        for streaming a defense); green = soft, red = tough. <b>Veg</b> = our
        rank of average opponent offense using 2026 Vegas implied team totals.{" "}
        <b>DS</b> = Draft Sharks' published DST strength-of-schedule. Two
        independent sources side by side: agreement = confidence, a gap = look
        closer.
        <br />* Turnovers / PF / PA are 2025 actuals; DST rank + proj points are
        2026 projections.
        <br />
        <b>Offense strength:</b> {meta.offenseSource}.
        <br />
        <b>Sources:</b> {meta.sources}
      </p>
    </main>
  );
}
