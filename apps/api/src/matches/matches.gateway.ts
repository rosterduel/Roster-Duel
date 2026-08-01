import { Injectable } from '@nestjs/common';
import { OnGatewayConnection, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * Real-time nice-to-have for the draft room — instant "opponent locked" /
 * "game ready" updates when both clients happen to be online at once.
 * Deliberately NOT the source of truth: spec section 4 explicitly allows
 * drafting asynchronously ("not required to be online simultaneously"), so
 * a client that reconnects later must be able to learn the current state
 * from GET /matches/:roomCode regardless of whether it caught these events.
 * The frontend polls that endpoint as the reliable fallback; this gateway
 * only shaves the latency down when both sides are live.
 */
@Injectable()
@WebSocketGateway({ cors: { origin: true } })
export class MatchesGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  handleConnection(): void {
    // No auth/handshake needed — clients join a room by code, which reveals
    // nothing sensitive (match state itself is fetched over authenticated
    // REST; the socket only carries "something changed, go refetch").
  }

  @SubscribeMessage('join')
  handleJoin(client: Socket, payload: { roomCode?: string }): void {
    if (payload?.roomCode) {
      client.join(payload.roomCode);
    }
  }

  notifyOpponentLocked(roomCode: string): void {
    this.server?.to(roomCode).emit('opponent:locked');
  }

  notifyMatchComplete(roomCode: string): void {
    this.server?.to(roomCode).emit('match:complete');
  }

  notifyRecapReady(roomCode: string): void {
    this.server?.to(roomCode).emit('recap:ready');
  }
}
