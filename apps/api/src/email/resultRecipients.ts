export interface RecipientSide {
  displayName: string;
  accountEmail: string | null;
  resultEmails: boolean;
  guestNotifyEmail: string | null;
}

export interface ResultRecipient {
  email: string;
  opponentName: string;
}

/**
 * Who gets "your matchup is ready": an account holder with result emails on
 * gets it at their account email; anyone else only if they typed an email
 * for this match. One email per address, even in a game against yourself.
 */
export function resultEmailRecipients(sideA: RecipientSide, sideB: RecipientSide): ResultRecipient[] {
  const out: ResultRecipient[] = [];
  const seen = new Set<string>();
  for (const [me, them] of [
    [sideA, sideB],
    [sideB, sideA],
  ] as const) {
    const email = me.accountEmail ? (me.resultEmails ? me.accountEmail : null) : me.guestNotifyEmail;
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({ email, opponentName: them.displayName });
  }
  return out;
}
