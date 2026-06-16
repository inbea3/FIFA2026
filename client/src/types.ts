export interface User {
  id: number;
  username: string;
  balance: number;
}

export interface MatchOdds {
  wdl: { home: number; draw: number; away: number; labels: Record<string, string> };
  handicap: {
    line: number;
    lineLabel: string;
    home: number;
    draw: number;
    away: number;
    labels: Record<string, string>;
  };
}

export interface Match {
  matchNumber: number;
  date: string;
  kickoffUtc: string;
  group: string;
  matchdayZh?: string;
  homeTeam: string;
  homeTeamZh: string;
  awayTeam: string;
  awayTeamZh: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  stadium: string;
  hostCityZh: string;
  odds: MatchOdds;
  kickoffCnDate?: string;
  kickoffCnTime?: string;
  kickoffCnMs?: number;
  marketOpen?: boolean;
}

export interface Bet {
  id: number;
  match_number: number;
  bet_type: 'wdl' | 'handicap';
  selection: 'home' | 'draw' | 'away';
  handicap: number | null;
  odds: number;
  stake: number;
  potential_win: number;
  status: 'pending' | 'won' | 'lost';
  payout: number | null;
  created_at: string;
  match: Match | null;
}

export interface LeaderboardEntry {
  rank: number;
  id: number;
  username: string;
  balance: number;
}

export interface BetSelection {
  match: Match;
  betType: 'wdl' | 'handicap';
  selection: 'home' | 'draw' | 'away';
  odds: number;
  label: string;
}
