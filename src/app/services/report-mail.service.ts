import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { CloudSyncService } from './cloud-sync.service';
import { PdfReportService } from './pdf-report.service';

export type MailRecipient = { name: string; detail: string; email: string };

const SEND_URL = '/.netlify/functions/send-report';

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

    let res: Response;
    try {
      res = await fetch(SEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-acmt-password': this.auth.password },
        body: JSON.stringify({
          year,
          recipients: emails,
          pdfBase64: base64,
          fileName,
          message,
          summary: { collected: report.collected, used: report.used, savings: report.savings },
        }),
      });
    } catch {
      throw new Error('Could not reach the server. Check your internet connection.');
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      throw new Error(data?.error ?? `Sending failed (HTTP ${res.status}). Email only works on the deployed site.`);
    }
    return data;
  }
}
