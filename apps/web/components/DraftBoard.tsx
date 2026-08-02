'use client';

import { useMemo, useState } from 'react';
import { NBA_POSITIONS, POSITION_LABELS, POSITION_STAT_FIELDS } from '../lib/positions';
import { DraftPoolPlayer, ERA_LABELS, Era, NbaPosition, SlotPool } from '../lib/types';
import { PlayerCard } from './PlayerCard';

function RespinButton({
  label,
  available,
  usedGlobally,
  onClick,
  disabled,
}: {
  label: string;
  available: boolean;
  usedGlobally: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  const remaining = usedGlobally ? 0 : 1;
  const title = usedGlobally
    ? `${label} respin already used`
    : available
      ? `Respin ${label} — 1 use, shared across all 6 slots`
      : `No alternative ${label.toLowerCase()} available for this slot`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !available}
      title={title}
      className={`flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition ${
        available && !disabled ? 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100' : 'border-gray-200 bg-gray-50 text-gray-400'
      }`}
    >
      <span aria-hidden>🔄</span>
      {label} respin
      <span className="font-mono">({remaining})</span>
    </button>
  );
}

export function DraftBoard({
  draftPool,
  slots,
  onPick,
  onRespin,
  locked,
  teamRespinUsed,
  eraRespinUsed,
}: {
  draftPool: Record<string, SlotPool>;
  slots: Record<string, string>;
  onPick: (position: NbaPosition, playerId: string) => void;
  onRespin: (position: NbaPosition, type: 'team' | 'era') => void;
  locked: boolean;
  teamRespinUsed: boolean;
  eraRespinUsed: boolean;
}) {
  const [activePosition, setActivePosition] = useState<NbaPosition>('PG');
  const [sortKey, setSortKey] = useState('ppg');

  const activeSlot = draftPool[activePosition];
  const playersById = useMemo(() => {
    const map = new Map<string, DraftPoolPlayer>();
    for (const slot of Object.values(draftPool)) {
      for (const p of slot.players) map.set(p.id, p);
    }
    return map;
  }, [draftPool]);

  const sortOptions = useMemo(() => {
    const fields = POSITION_STAT_FIELDS[activePosition] ?? [];
    const opts = [{ key: 'baseRating', label: 'Rating' }, ...fields.map((f) => ({ key: f.key, label: f.label }))];
    // PPG first if present, since it's the default (spec section 4c: "default sort by PPG").
    const ppgIndex = opts.findIndex((o) => o.key === 'ppg');
    if (ppgIndex > 0) {
      const [ppg] = opts.splice(ppgIndex, 1);
      opts.unshift(ppg);
    }
    return opts;
  }, [activePosition]);

  const sortedPlayers = useMemo(() => {
    if (!activeSlot) return [];
    const valueOf = (p: DraftPoolPlayer) => (sortKey === 'baseRating' ? p.baseRating : (p.stats[sortKey] ?? -Infinity));
    return [...activeSlot.players].sort((a, b) => valueOf(b) - valueOf(a));
  }, [activeSlot, sortKey]);

  // Reset the sort choice to the new slot's default (PPG) when switching tabs,
  // since a stat key valid for one position (e.g. BPG) may not be visible for another.
  function selectPosition(pos: NbaPosition) {
    setActivePosition(pos);
    setSortKey('ppg');
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {NBA_POSITIONS.map((pos) => {
          const filledPlayer = slots[pos] ? playersById.get(slots[pos]) : undefined;
          const slot = draftPool[pos];
          return (
            <button
              key={pos}
              type="button"
              data-testid={`position-tab-${pos}`}
              onClick={() => selectPosition(pos)}
              className={`rounded-lg border p-2 text-left text-xs transition ${
                activePosition === pos ? 'border-orange-500 ring-1 ring-orange-500' : 'border-gray-200'
              } ${filledPlayer ? 'bg-green-50' : 'bg-white'}`}
            >
              <div className="flex items-center gap-1 font-semibold text-gray-700">
                {slot && <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: slot.teamColorHex }} />}
                {pos}
              </div>
              <div className="truncate text-gray-500">{filledPlayer ? filledPlayer.name : slot ? `${slot.teamName} ${ERA_LABELS[slot.era as Era] ?? slot.era}` : '…'}</div>
            </button>
          );
        })}
      </div>

      {activeSlot && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: activeSlot.teamColorHex }} />
            <div>
              <div className="font-semibold text-gray-800">
                {activeSlot.teamName} · {ERA_LABELS[activeSlot.era as Era] ?? activeSlot.era}
              </div>
              <div className="text-xs text-gray-500">{POSITION_LABELS[activePosition]} pool</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RespinButton
              label="Team"
              available={activeSlot.teamRespinAvailable}
              usedGlobally={teamRespinUsed}
              onClick={() => onRespin(activePosition, 'team')}
              disabled={locked}
            />
            <RespinButton
              label="Era"
              available={activeSlot.eraRespinAvailable}
              usedGlobally={eraRespinUsed}
              onClick={() => onRespin(activePosition, 'era')}
              disabled={locked}
            />
          </div>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-600">{POSITION_LABELS[activePosition]} pool</h2>
        <label className="flex items-center gap-1 text-xs text-gray-500">
          Sort by
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="rounded border border-gray-300 px-1 py-0.5">
            {sortOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sortedPlayers.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            slotPosition={activePosition}
            selected={slots[activePosition] === player.id}
            disabled={locked}
            onSelect={() => onPick(activePosition, player.id)}
          />
        ))}
        {sortedPlayers.length === 0 && (
          <p className="col-span-full rounded border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
            No eligible players in this pool — this is a known limitation of the current seed pool.{' '}
            {(activeSlot?.teamRespinAvailable || activeSlot?.eraRespinAvailable) && 'Try a respin above.'}
          </p>
        )}
      </div>
    </div>
  );
}
