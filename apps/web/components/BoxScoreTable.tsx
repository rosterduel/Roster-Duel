import { PlayerBoxScoreLine } from '../lib/types';

function pct(made: number, attempted: number): string {
  if (attempted === 0) return '—';
  return `${Math.round((made / attempted) * 100)}%`;
}

export function BoxScoreTable({ teamName, lines, mvpPlayerId }: { teamName: string; lines: PlayerBoxScoreLine[]; mvpPlayerId?: string }) {
  return (
    <div className="overflow-x-auto">
      <h3 className="mb-2 font-semibold">{teamName}</h3>
      <table className="w-full min-w-[560px] text-left text-xs">
        <thead>
          <tr className="text-gray-400">
            <th className="py-1 pr-2">Player</th>
            <th className="px-2 text-right">PTS</th>
            <th className="px-2 text-right">REB</th>
            <th className="px-2 text-right">AST</th>
            <th className="px-2 text-right">STL</th>
            <th className="px-2 text-right">BLK</th>
            <th className="px-2 text-right">TOV</th>
            <th className="px-2 text-right">FG</th>
            <th className="px-2 text-right">3PT</th>
            <th className="px-2 text-right">FT</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.playerId} className={`border-t border-gray-100 ${l.playerId === mvpPlayerId ? 'bg-orange-50 font-medium' : ''}`}>
              <td className="py-1 pr-2">
                {l.name} {l.playerId === mvpPlayerId && <span title="Game MVP">⭐</span>}
              </td>
              <td className="px-2 text-right">{l.points}</td>
              <td className="px-2 text-right">{l.rebounds}</td>
              <td className="px-2 text-right">{l.assists}</td>
              <td className="px-2 text-right">{l.steals}</td>
              <td className="px-2 text-right">{l.blocks}</td>
              <td className="px-2 text-right">{l.turnovers}</td>
              <td className="px-2 text-right">
                {l.fieldGoalsMade}-{l.fieldGoalsAttempted} ({pct(l.fieldGoalsMade, l.fieldGoalsAttempted)})
              </td>
              <td className="px-2 text-right">
                {l.threesMade}-{l.threesAttempted} ({pct(l.threesMade, l.threesAttempted)})
              </td>
              <td className="px-2 text-right">
                {l.freeThrowsMade}-{l.freeThrowsAttempted} ({pct(l.freeThrowsMade, l.freeThrowsAttempted)})
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
