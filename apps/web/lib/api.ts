import { getSessionToken } from './session';
import { CreateMatchResponse, GameResult, MatchState, PlayerSummary } from './types';

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
  getPlayers: (sport = 'nba') => request<PlayerSummary[]>(`/players?sport=${sport}`),

  createMatch: (draftTimerSeconds?: number) =>
    request<CreateMatchResponse>('/matches', { method: 'POST', body: JSON.stringify({ draftTimerSeconds }) }),

  joinMatch: (roomCode: string) => request<CreateMatchResponse>(`/matches/${roomCode}/join`, { method: 'POST' }),

  getMatchState: (roomCode: string) => request<MatchState>(`/matches/${roomCode}`),

  saveDraftSlots: (rosterId: string, slots: Record<string, string>) =>
    request<{ ok: true }>(`/matches/roster/${rosterId}/slots`, { method: 'POST', body: JSON.stringify({ slots }) }),

  lockRoster: (rosterId: string) => request<MatchState>(`/matches/roster/${rosterId}/lock`, { method: 'POST' }),

  regenerateRecap: (roomCode: string) => request<GameResult>(`/matches/${roomCode}/recap`, { method: 'POST' }),
};
