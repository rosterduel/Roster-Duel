import { randomInt } from 'crypto';

// Excludes visually-ambiguous characters (0/O, 1/I/L) since this gets read
// aloud/typed from a shared link — short and friend-shareable, not a
// security token (the match itself has no sensitive data before it's
// simulated, and joining just claims the second roster slot).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}
