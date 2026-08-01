import { DraftRoomClient } from './DraftRoomClient';

export default async function MatchPage({ params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = await params;
  return <DraftRoomClient roomCode={roomCode.toUpperCase()} />;
}
