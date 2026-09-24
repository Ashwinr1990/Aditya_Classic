import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { CloudSyncService } from './cloud-sync.service';
import { PdfReportService } from './pdf-report.service';

export type MailRecipient = { name: string; detail: string; email: string };

const SEND_URL = '/.netlify/functions/send-report';
const SETTINGS_URL = '/.netlify/functions/mail-settings';
const BATCH_SIZE = 10; // must not exceed MAX_RECIPIENTS in send-report.mts

/** Emails the yearly PDF report to selected people through the send-report Netlify function. */
@Injectable({ providedIn: 'root' })
export class ReportMailService {
  constructor(
    private auth: AuthService,
    private cloudSync: CloudSyncService,
    private pdf: PdfReportService,
  ) {}

  /** Everyone with a saved email: the admin first, then residents in list order. */
  recipients(): { list: MailRecipient[]; withoutEmail: number } {
    const list: MailRecipient[] = [];
    const admin = this.auth.adminEmail();
    if (admin) list.push({ name: 'Admin', detail: '', email: admin });
    let withoutEmail = 0;
    let people: { name: string; unit: string; email?: string }[] = [];
    try {
      people = JSON.parse(localStorage.getItem('people') || '[]');
    } catch {}
    for (const p of people) {
      if (!p.email) {
        withoutEmail++;
        continue;
      }
      if (list.some(r => r.email.toLowerCase() === p.email!.toLowerCase())) continue;
      list.push({ name: p.name, detail: p.unit, email: p.email });
    }
    return { list, withoutEmail };
  }

  /** Builds the PDF for `year` and emails it. Throws with a user-facing message on failure. */
  async send(year: number, emails: string[], message: string): Promise<{ sent: number; from: string }> {
    // Upload any pending edits first: the server only sends to emails in the saved data.
    await this.cloudSync.save();
    const { base64, fileName, report } = await this.pdf.buildForEmail(year);

    // Each person gets a separate email; the server sends a limited number per request.
    let sent = 0;
    let from = '';
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const sentBefore = sent ? `Sent to ${sent} of ${emails.length} people, then stopped. ` : '';
      let res: Response;
      try {
        res = await fetch(SEND_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-acmt-password': this.auth.password },
          body: JSON.stringify({
            year,
            recipients: emails.slice(i, i + BATCH_SIZE),
            pdfBase64: base64,
            fileName,
            message,
            summary: { collected: report.collected, used: report.used, savings: report.savings },
          }),
        });
      } catch {
        throw new Error(sentBefore + 'Could not reach the server. Check your internet connection.');
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        const partial = sent + (data?.sent ?? 0);
        throw new MailError(
          (partial ? `Sent to ${partial} of ${emails.length} people, then stopped. ` : '') +
            (data?.error ?? `Sending failed (HTTP ${res.status}). Email only works on the deployed site.`),
          !!data?.setupNeeded,
        );
      }
      sent += data.sent;
      from = data.from;
    }
    return { sent, from };
  }

  /** Whether a Gmail App Password is configured (the password itself is never returned). */
  async settings(): Promise<MailSettings> {
    return this.settingsRequest('GET');
  }

  /** Saves the Gmail App Password after the server checks it with Gmail. */
  async savePassword(password: string): Promise<MailSettings> {
    await this.cloudSync.save(); // the server reads the admin email from the saved data
    return this.settingsRequest('PUT', { password });
  }

  private async settingsRequest(method: 'GET' | 'PUT', body?: unknown): Promise<MailSettings> {
    let res: Response;
    try {
      res = await fetch(SETTINGS_URL, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-acmt-password': this.auth.password },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new Error('Could not reach the server. Check your internet connection.');
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error(data?.error ?? `Request failed (HTTP ${res.status}).`);
    return data;
  }
}

export type MailSettings = { adminEmail: string | null; configured: boolean; source: 'netlify' | 'app' | null };

/** A send failure; `setupNeeded` means the App Password is missing or was rejected by Gmail. */
export class MailError extends Error {
  constructor(message: string, readonly setupNeeded: boolean) {
    super(message);
  }
}
