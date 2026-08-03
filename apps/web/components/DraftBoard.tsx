'use client';

import { useMemo, useState } from 'react';
import { NBA_POSITIONS, POSITION_LABELS, ROUND_SORT_FIELDS } from '../lib/positions';
import { computeRespinDisplay } from '../lib/respinDisplay';
import { CurrentRound, ERA_LABELS, Era, NbaPosition, PickResult, RoundPlayer } from '../lib/types';
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
  // See lib/respinDisplay.ts: the displayed count and the `!available` half
  // of clickability MUST come from the same computation, or they can
  // disagree (the bug this replaced — see its doc comment for the full
  // story). `disabled` here is a separate, transient reason to grey out
  // (a pick in flight) that doesn't affect the resource count.
  const { remaining } = computeRespinDisplay(usedGlobally, available);
  const title = usedGlobally
    ? `${label} respin already used`
    : available
      ? `Respin ${label} — 1 use for the whole draft, usable on any round before its pick locks in`
      : `No alternative ${label.toLowerCase()} available for this round`;

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

/** The "Larry Bird — Choose Position" prompt (spec 4c step 4) for a player eligible for more than one currently-open slot. */
function ChoosePositionModal({ player, options, onChoose, onCancel }: { player: RoundPlayer; options: NbaPosition[]; onChoose: (position: NbaPosition) => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl">
        <h3 className="font-semibold">{player.name} — Choose Position</h3>
        <p className="mt-1 text-sm text-gray-500">Eligible for more than one open slot — pick which one to fill.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {options.map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => onChoose(pos)}
              className="rounded border border-orange-300 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100"
            >
              {POSITION_LABELS[pos]}
            </button>
          ))}
        </div>
        <button type="button" onClick={onCancel} className="mt-3 text-xs text-gray-500 underline">
          Cancel
        </button>
      </div>
    </div>
  );
}

export function DraftBoard({
  currentRound,
  yourSlots,
  pickedNames,
  onPick,
  onRespin,
  locked,
  teamRespinUsed,
  eraRespinUsed,
}: {
  currentRound: CurrentRound | null;
  yourSlots: Record<string, string>;
  /** Best-effort, this-session-only position -> player name map for the progress strip (spec 4c doesn't require persisting this across a reload). */
  pickedNames: Record<string, string>;
  onPick: (player: RoundPlayer, position?: string) => Promise<PickResult>;
  onRespin: (type: 'team' | 'era') => void;
  locked: boolean;
  teamRespinUsed: boolean;
  eraRespinUsed: boolean;
}) {
  const [sortKey, setSortKey] = useState('ppg');
  const [pendingChoice, setPendingChoice] = useState<{ player: RoundPlayer; options: NbaPosition[] } | null>(null);

  const sortedPlayers = useMemo(() => {
    if (!currentRound) return [];
    const valueOf = (p: RoundPlayer) => (sortKey === 'baseRating' ? p.baseRating : (p.stats[sortKey] ?? -Infinity));
    return [...currentRound.players].sort((a, b) => valueOf(b) - valueOf(a));
  }, [currentRound, sortKey]);

  async function handleSelect(player: RoundPlayer) {
    if (locked) return;
    const result = await onPick(player);
    if (result.status === 'choose_position') {
      setPendingChoice({ player, options: result.eligiblePositions });
    }
  }

  async function handleChoosePosition(position: NbaPosition) {
    if (!pendingChoice) return;
    await onPick(pendingChoice.player, position);
    setPendingChoice(null);
  }

  if (!currentRound) {
    return <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-gray-500">Every position is filled — ready to lock in your roster.</p>;
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {NBA_POSITIONS.map((pos) => {
          const filled = Boolean(yourSlots[pos]);
          return (
            <div key={pos} className={`rounded-lg border p-2 text-left text-xs ${filled ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}>
              <div className="font-semibold text-gray-700">{pos}</div>
              <div className="truncate text-gray-500">{filled ? (pickedNames[pos] ?? '✓ picked') : '—'}</div>
            </div>
          );
        })}
      </div>

      <div key={currentRound.roundIndex} className="animate-round-reveal mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex items-center gap-2">
          <span className="inline-block h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: currentRound.teamColorHex }} />
          <div>
            <div className="font-semibold text-gray-800">
              {currentRound.teamName} · {ERA_LABELS[currentRound.era as Era] ?? currentRound.era}
            </div>
            <div className="text-xs text-gray-500">
              Round {currentRound.roundIndex + 1} of {currentRound.totalRounds}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RespinButton label="Team" available={currentRound.teamRespinAvailable} usedGlobally={teamRespinUsed} onClick={() => onRespin('team')} disabled={locked} />
          <RespinButton label="Era" available={currentRound.eraRespinAvailable} usedGlobally={eraRespinUsed} onClick={() => onRespin('era')} disabled={locked} />
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-600">This round&apos;s roster</h2>
        <label className="flex items-center gap-1 text-xs text-gray-500">
          Sort by
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="rounded border border-gray-300 px-1 py-0.5">
            <option value="baseRating">Rating</option>
            {ROUND_SORT_FIELDS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sortedPlayers.map((player) => (
          <PlayerCard key={player.id} player={player} disabled={locked} onSelect={handleSelect} />
        ))}
      </div>

      {pendingChoice && (
        <ChoosePositionModal player={pendingChoice.player} options={pendingChoice.options} onChoose={handleChoosePosition} onCancel={() => setPendingChoice(null)} />
      )}
    </div>
  );
}
