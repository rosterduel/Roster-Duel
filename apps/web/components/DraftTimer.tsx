'use client';

import { useEffect, useState } from 'react';

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function DraftTimer({ deadline, onExpire }: { deadline: string; onExpire?: () => void }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = new Date(deadline).getTime() - now;

  useEffect(() => {
    if (remainingMs <= 0) onExpire?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs <= 0]);

  const urgent = remainingMs > 0 && remainingMs < 30_000;

  return <span className={urgent ? 'font-mono text-red-500 font-bold' : 'font-mono'}>{formatRemaining(remainingMs)}</span>;
}
