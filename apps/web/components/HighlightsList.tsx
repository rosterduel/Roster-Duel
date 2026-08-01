import { Highlight } from '../lib/types';

export function HighlightsList({ highlights }: { highlights: Highlight[] }) {
  return (
    <ol className="space-y-2">
      {highlights.map((h, i) => (
        <li key={h.possessionIndex} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
          <span className="mr-2 font-mono text-xs text-gray-400">#{i + 1}</span>
          {h.description}
          <span className="ml-2 text-xs text-orange-600">{Math.round(Math.abs(h.leverageScore) * 100)}% swing</span>
        </li>
      ))}
    </ol>
  );
}
