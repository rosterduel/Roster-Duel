'use client';

import { useEffect, useState } from 'react';

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Null `deadline` means the match has no draft timer (spec section 4's default) — renders a static label instead of a countdown. */
export function DraftTimer({ deadline, onExpire }: { deadline: string | null; onExpire?: () => void }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  const remainingMs = deadline ? new Date(deadline).getTime() - now : null;

  useEffect(() => {
    if (remainingMs !== null && remainingMs <= 0) onExpire?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs !== null && remainingMs <= 0]);

  if (remainingMs === null) {
    return <span className="text-gray-500">No time limit</span>;
  }

  const urgent = remainingMs > 0 && remainingMs < 30_000;

  return <span className={urgent ? 'font-mono text-red-500 font-bold' : 'font-mono'}>{formatRemaining(remainingMs)}</span>;
}
