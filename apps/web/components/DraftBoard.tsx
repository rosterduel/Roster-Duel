'use client';

import { useMemo, useState } from 'react';
import { NBA_POSITIONS, POSITION_LABELS } from '../lib/positions';
import { NbaPosition, PlayerSummary } from '../lib/types';
import { PlayerCard } from './PlayerCard';

export function DraftBoard({
  players,
  slots,
  onPick,
  locked,
}: {
  players: PlayerSummary[];
  slots: Record<string, string>;
  onPick: (position: NbaPosition, playerId: string) => void;
  locked: boolean;
}) {
  const [activePosition, setActivePosition] = useState<NbaPosition>('PG');
  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const pool = useMemo(
    () =>
      players
        .filter((p) => p.position === activePosition)
        .sort((a, b) => b.baseRating - a.baseRating),
    [players, activePosition],
  );

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {NBA_POSITIONS.map((pos) => {
          const filledPlayer = slots[pos] ? playersById.get(slots[pos]) : undefined;
          return (
            <button
              key={pos}
              type="button"
              data-testid={`position-tab-${pos}`}
              onClick={() => setActivePosition(pos)}
              className={`rounded-lg border p-2 text-left text-xs transition ${
                activePosition === pos ? 'border-orange-500 ring-1 ring-orange-500' : 'border-gray-200'
              } ${filledPlayer ? 'bg-green-50' : 'bg-white'}`}
            >
              <div className="font-semibold text-gray-700">{pos}</div>
              <div className="truncate text-gray-500">{filledPlayer ? filledPlayer.name : 'Empty'}</div>
            </button>
          );
        })}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-gray-600">{POSITION_LABELS[activePosition]} pool</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pool.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            selected={slots[activePosition] === player.id}
            disabled={locked}
            onSelect={() => onPick(activePosition, player.id)}
          />
        ))}
      </div>
    </div>
  );
}
