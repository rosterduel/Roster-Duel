import { DraftRoomClient } from './DraftRoomClient';

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomCode: string }>;
  searchParams: Promise<{ play?: string | string[] }>;
}) {
  const { roomCode } = await params;
  const { play } = await searchParams;
  // ?play=1 comes from the "Run your simulation" button in the result-ready email.
  return <DraftRoomClient roomCode={roomCode.toUpperCase()} autoPlay={play === '1'} />;
}
