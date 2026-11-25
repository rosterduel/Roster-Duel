import { Injectable, Logger } from '@nestjs/common';
import { EmailContent } from './templates';

// RESEND_API_URL only exists so tests can point at a local stand-in.
const RESEND_ENDPOINT = process.env.RESEND_API_URL || 'https://api.resend.com/emails';

/**
 * Sends email through Resend's HTTP API (plain fetch, no SDK). Needs
 * RESEND_API_KEY and RESEND_FROM (e.g. "RosterDuel <notifications@mail.rosterduel.com>")
 * on the API service. With either unset, sending is skipped and logged, so
 * the app runs fine before email is set up. Never throws: a failed email
 * must not break a match or a log-in.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  isConfigured(): boolean {
    return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
  }

  async send(to: string, content: EmailContent): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.log(`Email not set up (RESEND_API_KEY / RESEND_FROM missing); skipped "${content.subject}".`);
      return false;
    }
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.RESEND_FROM, to: [to], subject: content.subject, html: content.html, text: content.text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.warn(`Email "${content.subject}" was refused by Resend with status ${res.status}.`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(`Email "${content.subject}" failed to send: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }
}
