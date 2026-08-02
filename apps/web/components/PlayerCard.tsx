'use client';

import { ESTIMATE_TOOLTIPS, formatStatValue, POSITION_STAT_FIELDS } from '../lib/positions';
import { NbaPosition, PlayerSummary } from '../lib/types';

function RatingBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-gray-500">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-gray-200">
        <div className="h-1.5 rounded-full bg-orange-500" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className="w-8 text-right font-mono">{Math.round(value)}</span>
    </div>
  );
}

export function PlayerCard({
  player,
  onSelect,
  selected,
  disabled,
}: {
  player: PlayerSummary;
  onSelect?: (player: PlayerSummary) => void;
  selected?: boolean;
  disabled?: boolean;
}) {
  const fields = POSITION_STAT_FIELDS[player.position as NbaPosition] ?? [];
  const era = player.isActive ? `${player.stintStartYear}–present` : `${player.stintStartYear}–${player.stintEndYear}`;

  return (
    <div
      className={`rounded-lg border p-3 transition ${
        selected ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{player.name}</div>
          <div className="text-xs text-gray-500">
            {player.position} · {era}
          </div>
        </div>
        {onSelect && (
          <button
            type="button"
            data-testid={`draft-player-${player.id}`}
            disabled={disabled}
            onClick={() => onSelect(player)}
            className="shrink-0 rounded bg-orange-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {selected ? 'Selected' : 'Draft'}
          </button>
        )}
      </div>

      <div className="mt-2 grid grid-cols-4 gap-x-2 gap-y-1 text-xs text-gray-700">
        {fields.map((f) => {
          const estimateReason = player.estimatedStats[f.key];
          return (
            <div key={f.key}>
              <span className="text-gray-400">{f.label}</span> {formatStatValue(player.stats[f.key], f.format)}
              {estimateReason && (
                <span className="cursor-help text-orange-500" title={ESTIMATE_TOOLTIPS[estimateReason]}>
                  *
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 space-y-1">
        <RatingBar label="Rating" value={player.baseRating} />
      </div>
    </div>
  );
}
