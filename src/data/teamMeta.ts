export interface TeamInfo {
  city: string;
  nickname: string;
  byeWeek: number | null;
}

// byeWeek: 2026 NFL schedule via ESPN proTeamSchedules_wl (sourced 2026-05-27).
export const teamMeta: Record<string, TeamInfo> = {
  ARI: { city: "Arizona", nickname: "Cardinals", byeWeek: 14 },
  ATL: { city: "Atlanta", nickname: "Falcons", byeWeek: 11 },
  BAL: { city: "Baltimore", nickname: "Ravens", byeWeek: 13 },
  BUF: { city: "Buffalo", nickname: "Bills", byeWeek: 7 },
  CAR: { city: "Carolina", nickname: "Panthers", byeWeek: 5 },
  CHI: { city: "Chicago", nickname: "Bears", byeWeek: 10 },
  CIN: { city: "Cincinnati", nickname: "Bengals", byeWeek: 6 },
  CLE: { city: "Cleveland", nickname: "Browns", byeWeek: 11 },
  DAL: { city: "Dallas", nickname: "Cowboys", byeWeek: 14 },
  DEN: { city: "Denver", nickname: "Broncos", byeWeek: 10 },
  DET: { city: "Detroit", nickname: "Lions", byeWeek: 6 },
  GB: { city: "Green Bay", nickname: "Packers", byeWeek: 11 },
  HOU: { city: "Houston", nickname: "Texans", byeWeek: 8 },
  IND: { city: "Indianapolis", nickname: "Colts", byeWeek: 13 },
  JAX: { city: "Jacksonville", nickname: "Jaguars", byeWeek: 7 },
  KC: { city: "Kansas City", nickname: "Chiefs", byeWeek: 5 },
  LAC: { city: "Los Angeles", nickname: "Chargers", byeWeek: 7 },
  LAR: { city: "Los Angeles", nickname: "Rams", byeWeek: 11 },
  LV: { city: "Las Vegas", nickname: "Raiders", byeWeek: 13 },
  MIA: { city: "Miami", nickname: "Dolphins", byeWeek: 6 },
  MIN: { city: "Minnesota", nickname: "Vikings", byeWeek: 6 },
  NE: { city: "New England", nickname: "Patriots", byeWeek: 11 },
  NO: { city: "New Orleans", nickname: "Saints", byeWeek: 8 },
  NYG: { city: "New York", nickname: "Giants", byeWeek: 8 },
  NYJ: { city: "New York", nickname: "Jets", byeWeek: 13 },
  PHI: { city: "Philadelphia", nickname: "Eagles", byeWeek: 10 },
  PIT: { city: "Pittsburgh", nickname: "Steelers", byeWeek: 9 },
  SEA: { city: "Seattle", nickname: "Seahawks", byeWeek: 11 },
  SF: { city: "San Francisco", nickname: "49ers", byeWeek: 8 },
  TB: { city: "Tampa Bay", nickname: "Buccaneers", byeWeek: 10 },
  TEN: { city: "Tennessee", nickname: "Titans", byeWeek: 9 },
  WSH: { city: "Washington", nickname: "Commanders", byeWeek: 7 },
  FA: { city: "Free Agent", nickname: "FA", byeWeek: null },
};
