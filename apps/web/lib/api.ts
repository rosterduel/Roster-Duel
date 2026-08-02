import { getSessionToken } from './session';
import { CreateMatchRequest, CreateMatchResponse, GameResult, LeaderboardEntry, MatchState, PlayerSummary, PublicUser, Team, UserRecord } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Token': getSessionToken(),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.message ?? `Request to ${path} failed with ${res.status}`, res.status);
  }

  return res.json() as Promise<T>;
}

export const api = {
  /** Legacy free-browse pool — interim/superseded by the per-slot draft pool embedded in match state (spec 4c). Kept only for backward compatibility. */
  getPlayers: (sport = 'nba') => request<PlayerSummary[]>(`/players?sport=${sport}`),

  getTeams: (sport = 'nba') => request<Team[]>(`/teams?sport=${sport}`),

  createMatch: (options: CreateMatchRequest) => request<CreateMatchResponse>('/matches', { method: 'POST', body: JSON.stringify(options) }),

  joinMatch: (roomCode: string) => request<CreateMatchResponse>(`/matches/${roomCode}/join`, { method: 'POST' }),

  getMatchState: (roomCode: string) => request<MatchState>(`/matches/${roomCode}`),

  saveDraftSlots: (rosterId: string, slots: Record<string, string>) =>
    request<{ ok: true }>(`/matches/roster/${rosterId}/slots`, { method: 'POST', body: JSON.stringify({ slots }) }),

  respinSlot: (rosterId: string, position: string, type: 'team' | 'era') =>
    request<MatchState>(`/matches/roster/${rosterId}/respin`, { method: 'POST', body: JSON.stringify({ position, type }) }),

  lockRoster: (rosterId: string) => request<MatchState>(`/matches/roster/${rosterId}/lock`, { method: 'POST' }),

  regenerateRecap: (roomCode: string) => request<GameResult>(`/matches/${roomCode}/recap`, { method: 'POST' }),

  getMe: () => request<PublicUser>('/users/me'),

  changeDisplayName: (displayName: string) =>
    request<PublicUser>('/users/me/display-name', { method: 'PATCH', body: JSON.stringify({ displayName }) }),

  getMyRecord: () => request<UserRecord>('/stats/me'),

  getLeaderboard: (limit = 20) => request<LeaderboardEntry[]>(`/leaderboard?limit=${limit}`),
};
