export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function layout(heading: string, paragraph: string, buttonLabel: string, url: string, footer: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">
          <tr><td style="font-size:22px;font-weight:700;">RosterDuel</td></tr>
          <tr><td style="padding-top:16px;font-size:18px;font-weight:600;">${heading}</td></tr>
          <tr><td style="padding-top:8px;font-size:15px;line-height:22px;color:#374151;">${paragraph}</td></tr>
          <tr><td style="padding-top:24px;">
            <a href="${escapeHtml(url)}" style="display:inline-block;background:#ea580c;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px;">${buttonLabel}</a>
          </td></tr>
          <tr><td style="padding-top:24px;font-size:12px;line-height:18px;color:#9ca3af;">${footer}</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

/** No score in the email, so the result isn't spoiled before they watch it. */
export function resultReadyEmail(opponentName: string, matchUrl: string): EmailContent {
  const safeOpponent = escapeHtml(opponentName);
  return {
    subject: 'Your RosterDuel matchup is ready',
    html: layout(
      'Your matchup is ready',
      `Both rosters are locked in for your game against <strong>${safeOpponent}</strong>. Tip it off and see who built the better team.`,
      'Run your simulation',
      matchUrl,
      "You're getting this because you asked RosterDuel to email you when this matchup was ready.",
    ),
    text: `Your matchup is ready.\n\nBoth rosters are locked in for your game against ${opponentName}.\n\nRun your simulation: ${matchUrl}\n\nYou're getting this because you asked RosterDuel to email you when this matchup was ready.`,
  };
}

export function passwordResetEmail(resetUrl: string, validMinutes: number): EmailContent {
  return {
    subject: 'Reset your RosterDuel password',
    html: layout(
      'Reset your password',
      `Someone asked to reset the password for this RosterDuel account. The link works once and expires in ${validMinutes} minutes.`,
      'Choose a new password',
      resetUrl,
      "If you didn't ask for this, you can ignore this email and your password stays the same.",
    ),
    text: `Reset your RosterDuel password.\n\nThe link works once and expires in ${validMinutes} minutes:\n${resetUrl}\n\nIf you didn't ask for this, you can ignore this email and your password stays the same.`,
  };
}
