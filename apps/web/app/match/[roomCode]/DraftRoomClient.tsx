'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { ApiError, api } from '../../../lib/api';
import { PickResult, RoundPlayer } from '../../../lib/types';
import type { MatchState } from '../../../lib/types';
import { NBA_POSITIONS } from '../../../lib/positions';
import { DraftBoard } from '../../../components/DraftBoard';
import { DraftTimer } from '../../../components/DraftTimer';
import { GameCastPlayback } from '../../../components/GameCastPlayback';
import { BoxScoreTable } from '../../../components/BoxScoreTable';
import { HighlightsList } from '../../../components/HighlightsList';
import { NewspaperRecap } from '../../../components/NewspaperRecap';

const POLL_INTERVAL_MS = 4000;
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function DraftRoomClient({ roomCode }: { roomCode: string }) {
  const [match, setMatch] = useState<MatchState | null>(null);
  const [rosterId, setRosterId] = useState<string | null>(null);
  // Best-effort, this-session-only record of what got picked into each
  // slot, purely for the progress strip's player-name display — the
  // server's source of truth is match.yourSlots (ids only); spec 4c
  // doesn't require persisting names across a reload.
  const [pickedNames, setPickedNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);
  const [picking, setPicking] = useState(false);
  const [showGameCast, setShowGameCast] = useState(false);

  const refetchState = useCallback(async () => {
    try {
      const state = await api.getMatchState(roomCode);
      setMatch(state);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load match.');
    }
  }, [roomCode]);

  // Join (idempotent) then start polling + websocket updates.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const joined = await api.joinMatch(roomCode);
        if (!cancelled) setRosterId(joined.rosterId);
      } catch (err) {
        // A full match (two other players) is a valid state, not fatal —
        // fall through to read-only state via getMatchState below.
        if (!(err instanceof ApiError && err.status === 409)) {
          if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to join match.');
        }
      }
      if (!cancelled) await refetchState();
    })();

    const interval = setInterval(refetchState, POLL_INTERVAL_MS);

    let socket: Socket | undefined;
    try {
      socket = io(API_BASE, { transports: ['websocket'] });
      socket.emit('join', { roomCode });
      socket.on('opponent:locked', refetchState);
      socket.on('match:complete', refetchState);
      socket.on('recap:ready', refetchState);
    } catch {
      // Websocket is a nice-to-have — polling above is the reliable fallback.
    }

    return () => {
      cancelled = true;
      clearInterval(interval);
      socket?.disconnect();
    };
  }, [roomCode, refetchState]);

  async function handlePick(player: RoundPlayer, position?: string): Promise<PickResult> {
    if (!rosterId) throw new Error('Not ready to pick yet.');
    setPicking(true);
    setError(null);
    try {
      const result = await api.pickPlayer(rosterId, player.id, position);
      if (result.status === 'locked') {
        const chosenPosition = Object.entries(result.match.yourSlots ?? {}).find(([, id]) => id === player.id)?.[0];
        if (chosenPosition) setPickedNames((prev) => ({ ...prev, [chosenPosition]: player.name }));
        setMatch(result.match);
      }
      return result;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to draft that player.');
      throw err;
    } finally {
      setPicking(false);
    }
  }

  async function handleRespin(type: 'team' | 'era') {
    if (!rosterId || picking) return;
    setPicking(true);
    setError(null);
    try {
      const state = await api.respinCurrentRound(rosterId, type);
      setMatch(state);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to respin.');
    } finally {
      setPicking(false);
    }
  }

  async function handleLock() {
    if (!rosterId) return;
    setLocking(true);
    setError(null);
    try {
      const state = await api.lockRoster(rosterId);
      setMatch(state);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to lock your roster.');
    } finally {
      setLocking(false);
    }
  }

  useEffect(() => {
    if (match?.status === 'complete') {
      const seenKey = `rd_gamecast_seen_${roomCode}`;
      if (!sessionStorage.getItem(seenKey)) {
        setShowGameCast(true);
        sessionStorage.setItem(seenKey, '1');
      }
    }
  }, [match?.status, roomCode]);

  if (error && !match) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <p className="text-red-600">{error}</p>
        <Link href="/" className="mt-4 inline-block text-orange-600 underline">
          Back home
        </Link>
      </main>
    );
  }

  if (!match) {
    return (
      <main className="mx-auto max-w-md p-6 text-center text-gray-500">
        <p>Loading match…</p>
      </main>
    );
  }

  const yourRoster = match.yourSide === 'A' ? match.sideA : match.yourSide === 'B' ? match.sideB : null;
  const opponentRoster = match.yourSide === 'A' ? match.sideB : match.yourSide === 'B' ? match.sideA : null;

  if (match.status === 'complete' && match.gameResult) {
    if (showGameCast) {
      return (
        <main className="mx-auto max-w-2xl p-6">
          <GameCastPlayback
            highlights={match.gameResult.highlights}
            teamAName={match.sideA.teamName ?? 'Team A'}
            teamBName={match.sideB.teamName ?? 'Team B'}
            onDone={() => setShowGameCast(false)}
          />
        </main>
      );
    }

    const gr = match.gameResult;

    return (
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <div className="text-center">
          <p className="text-sm text-gray-500">FINAL{gr.overtimePeriods > 0 ? ` / ${gr.overtimePeriods > 1 ? `${gr.overtimePeriods}OT` : 'OT'}` : ''}</p>
          <h1 className="text-3xl font-bold">
            {match.sideA.teamName} {gr.scoreA} — {gr.scoreB} {match.sideB.teamName}
          </h1>
          <p className="mt-1 text-gray-500">🏆 {gr.mvp.playerName} — Game MVP</p>
          <button type="button" onClick={() => setShowGameCast(true)} className="mt-2 text-xs text-orange-600 underline">
            Replay highlight animation
          </button>
        </div>

        <NewspaperRecap roomCode={roomCode} gameResult={gr} onRecapUpdated={(updated) => setMatch({ ...match, gameResult: updated })} />

        <section>
          <h2 className="mb-2 text-lg font-semibold">Top 5 Highlights</h2>
          <HighlightsList highlights={gr.highlights} />
        </section>

        <section className="space-y-6">
          <BoxScoreTable teamName={match.sideA.teamName ?? 'Team A'} lines={gr.boxScore.teamA} mvpPlayerId={gr.mvp.playerId} />
          <BoxScoreTable teamName={match.sideB.teamName ?? 'Team B'} lines={gr.boxScore.teamB} mvpPlayerId={gr.mvp.playerId} />
        </section>
      </main>
    );
  }

  if (match.status === 'simulating') {
    return (
      <main className="mx-auto max-w-md p-6 text-center text-gray-500">
        <p>Both rosters are locked — simulating the matchup…</p>
      </main>
    );
  }

  if (!match.yourSide) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <p className="text-gray-600">This match already has two players drafting.</p>
        <Link href="/" className="mt-4 inline-block text-orange-600 underline">
          Start your own match
        </Link>
      </main>
    );
  }

  if (yourRoster?.isLocked) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-semibold">Roster locked in ✅</h1>
        <p className="mt-2 text-gray-500">
          {opponentRoster?.joined
            ? opponentRoster.isLocked
              ? 'Both rosters are in — simulating…'
              : 'Waiting for your opponent to finish drafting.'
            : 'Waiting for an opponent to join. Share this link:'}
        </p>
        <p className="mt-3 rounded bg-gray-100 p-2 font-mono text-sm">{typeof window !== 'undefined' ? window.location.href : ''}</p>
      </main>
    );
  }

  const filledCount = NBA_POSITIONS.filter((p) => match.yourSlots?.[p]).length;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Draft your roster</h1>
          <p className="text-sm text-gray-500">
            Room <span className="font-mono">{roomCode}</span> ·{' '}
            {opponentRoster?.joined ? (opponentRoster.isLocked ? 'Opponent is ready' : 'Opponent is drafting too') : 'Waiting for an opponent to join'}
          </p>
        </div>
        <div className="text-sm text-gray-600">
          Time left: <DraftTimer deadline={yourRoster?.draftDeadline ?? null} onExpire={refetchState} />
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <DraftBoard
        currentRound={match.yourCurrentRound}
        yourSlots={match.yourSlots ?? {}}
        pickedNames={pickedNames}
        onPick={handlePick}
        onRespin={handleRespin}
        locked={locking || picking}
        teamRespinUsed={match.yourTeamRespinUsed ?? false}
        eraRespinUsed={match.yourEraRespinUsed ?? false}
      />

      <div className="mt-6 flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">{filledCount} / 6 positions filled</p>
        <button
          type="button"
          onClick={handleLock}
          disabled={locking || filledCount < NBA_POSITIONS.length}
          className="rounded bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {locking ? 'Locking…' : 'Lock roster'}
        </button>
      </div>
    </main>
  );
}
