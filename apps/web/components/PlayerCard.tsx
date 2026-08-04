'use client';

import { ESTIMATE_TOOLTIPS, formatStatValue, POSITION_STAT_FIELDS } from '../lib/positions';
import { NbaPosition, RoundPlayer } from '../lib/types';

export function PlayerCard({
  player,
  onSelect,
  disabled,
}: {
  player: RoundPlayer;
  onSelect?: (player: RoundPlayer) => void;
  disabled?: boolean;
}) {
  // No single "active slot" drives the stat line anymore (spec 4c's
  // sequential redesign shows the full, unfiltered roster) — each card
  // shows the stat line for the player's OWN canonical position instead
  // (eligiblePositions[0], same convention used for rating peer-grouping).
  const canonicalPosition: NbaPosition = player.eligiblePositions[0] ?? 'PG';
  const fields = POSITION_STAT_FIELDS[canonicalPosition] ?? [];
  const era = player.isActive ? `${player.stintStartYear}–present` : `${player.stintStartYear}–${player.stintEndYear}`;

  const hasNoOpenSlot = !player.isDuplicate && player.eligibleOpenPositions.length === 0;
  const grayedOut = player.isDuplicate || hasNoOpenSlot;
  const isDisabled = disabled || grayedOut;

  const buttonLabel = player.isDuplicate ? 'Already picked' : hasNoOpenSlot ? 'No slot open' : 'Draft';
  const cardTitle = player.isDuplicate
    ? 'Already drafted onto your roster'
    : hasNoOpenSlot
      ? 'No open position on your roster fits this player'
      : undefined;

  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-3 transition ${grayedOut ? 'opacity-40 grayscale' : disabled ? 'opacity-50' : ''}`} title={cardTitle}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{player.name}</div>
          <div className="text-xs text-gray-500">
            {player.eligiblePositions.join('/')} · {era}
          </div>
        </div>
        {onSelect && (
          <button
            type="button"
            data-testid={`draft-player-${player.id}`}
            disabled={isDisabled}
            onClick={() => onSelect(player)}
            className="shrink-0 rounded bg-orange-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {buttonLabel}
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
    </div>
  );
}
