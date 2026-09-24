import nodemailer from 'nodemailer';
// The ESM build: the default CommonJS build does a dynamic require() that fails in bundled ESM functions.
import * as XLSX from 'xlsx/xlsx.mjs';
import { FILE_KEY, dataStore, roleFor, smtpPassword } from '../lib/auth.mts';

// POST /.netlify/functions/send-report  (admin only)
// Body: { year, recipients: string[], pdfBase64, fileName, message?, summary? }
// Emails the PDF report through Gmail SMTP, always FROM the admin email saved in the app.
// Password: Google App Password of that Gmail account — Netlify's SMTP_PASS variable, or the one saved
//           from the app's Email setup (see mail-settings.mts).
// SMTP_USER: optional; if set it must equal the admin email (Gmail can only send as the signed-in account).
// Recipients must be emails saved in the app (people or admin), so this can't be used to email strangers.
// Everyone is BCC'd, so residents don't see each other's addresses.

const MAX_RECIPIENTS = 90; // Gmail caps recipients per message
const MAX_PDF_BYTES = 4 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = {
  year?: number;
  recipients?: string[];
  pdfBase64?: string;
  fileName?: string;
  message?: string;
  summary?: { collected: number; used: number; savings: number };
};

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (roleFor(req) !== 'admin') return json({ error: 'Only the admin can send emails' }, 403);

  // Mail always goes from the admin email saved in the app.
  const { allowed, adminEmail } = await savedEmails();
  if (!adminEmail) {
    return json({ error: 'No admin email is saved. Log out and in again as admin to add it, then try again.' }, 400);
  }
  const { pass } = await smtpPassword();
  if (!pass) {
    return json({
      setupNeeded: true,
      error: `Email is not set up yet. Enter the Gmail App Password for ${adminEmail} in "Email setup" above.`,
    }, 400);
  }
  const smtpUser = Object.entries(process.env).find(([k]) => k.trim().toUpperCase() === 'SMTP_USER')?.[1]?.trim();
  if (smtpUser && smtpUser.toLowerCase() !== adminEmail.toLowerCase()) {
    return json({
      error: `Mail must go from the admin email ${adminEmail}, but Netlify's SMTP_USER is ${smtpUser}. ` +
        `Change SMTP_USER to ${adminEmail} (or delete it) and set SMTP_PASS to that account's App Password, then redeploy.`,
    }, 500);
  }
  const user = adminEmail;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }

  const year = Number(body.year);
  const recipients = [...new Set((body.recipients ?? []).map(e => String(e).trim().toLowerCase()))];
  if (!Number.isInteger(year)) return json({ error: 'Missing report year' }, 400);
  if (recipients.length === 0) return json({ error: 'Select at least one email' }, 400);
  if (recipients.length > MAX_RECIPIENTS) return json({ error: `Select at most ${MAX_RECIPIENTS} emails at a time` }, 400);
  if (recipients.some(e => !EMAIL_RE.test(e))) return json({ error: 'One of the emails is not valid' }, 400);

  const pdf = Buffer.from(body.pdfBase64 ?? '', 'base64');
  if (pdf.length === 0 || pdf.length > MAX_PDF_BYTES || pdf.subarray(0, 5).toString() !== '%PDF-') {
    return json({ error: 'The PDF attachment is missing or invalid' }, 400);
  }

  // Only emails saved in the app may receive the report.
  const unknown = recipients.filter(e => !allowed.has(e));
  if (unknown.length) {
    return json({ error: `Not an email saved in the app: ${unknown.join(', ')}. Save the data and try again.` }, 400);
  }

  const fileName = /^[\w.-]{1,80}\.pdf$/.test(body.fileName ?? '') ? body.fileName! : `ACMT-Report-${year}.pdf`;
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });

  try {
    await transporter.sendMail({
      from: { name: 'Aditya Classic Association', address: user },
      replyTo: user,
      to: { name: 'Aditya Classic Association', address: user },
      bcc: recipients,
      subject: `Aditya Classic Association · Financial Report ${year}`,
      text: textBody(year, body),
      html: htmlBody(year, body),
      attachments: [{ filename: fileName, content: pdf, contentType: 'application/pdf' }],
    });
  } catch (e: any) {
    console.error('sendMail failed', e);
    const auth = e?.code === 'EAUTH' || e?.responseCode === 535;
    return json({
      setupNeeded: auth,
      error: auth
        ? `Gmail rejected the login for ${user}. Update the App Password in "Email setup" above.`
        : 'Sending failed. Please try again later.',
    }, 502);
  }

  return json({ sent: recipients.length, from: user });
};

async function savedEmails(): Promise<{ allowed: Set<string>; adminEmail: string | null }> {
  const data = await dataStore().get(FILE_KEY, { type: 'arrayBuffer' });
  const allowed = new Set<string>();
  let adminEmail: string | null = null;
  if (!data) return { allowed, adminEmail };
  const wb = XLSX.read(new Uint8Array(data), { type: 'array' });
  const rows = (sheet: string) =>
    wb.Sheets[sheet] ? XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheet]) : [];
  for (const row of rows('people')) {
    if (row['email']) allowed.add(String(row['email']).trim().toLowerCase());
  }
  const admin = rows('adminProfile')[0]?.['email'];
  if (admin) {
    adminEmail = String(admin).trim();
    allowed.add(adminEmail.toLowerCase());
  }
  return { allowed, adminEmail };
}

function money(v: number): string {
  return `${v < 0 ? '-' : ''}Rs. ${new Intl.NumberFormat('en-IN').format(Math.abs(v))}`;
}

function textBody(year: number, body: Body): string {
  const lines = ['Dear Resident,', '', `Please find attached the financial report of Aditya Classic Association for ${year}.`];
  if (body.message?.trim()) lines.push('', body.message.trim());
  if (body.summary) {
    lines.push('', `Collected: ${money(body.summary.collected)}`, `Used: ${money(body.summary.used)}`,
      `Savings: ${money(body.summary.savings)}`);
  }
  lines.push('', 'Regards,', 'Aditya Classic Association');
  return lines.join('\n');
}

function htmlBody(year: number, body: Body): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  const s = body.summary;
  const card = (label: string, value: number, color: string) =>
    `<td style="padding:12px 16px;background:#f5f8fc;border-radius:8px;text-align:center">
       <div style="font-size:11px;color:#6b7280;font-weight:bold;letter-spacing:1px">${label}</div>
       <div style="font-size:20px;font-weight:bold;color:${color}">${money(value)}</div></td>`;
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#222">
    <div style="background:#0d47a1;color:#fff;padding:18px;text-align:center;border-radius:8px 8px 0 0">
      <div style="font-size:20px;font-weight:bold">Aditya Classic Association</div>
      <div style="font-size:13px;opacity:.9">Financial Report · ${year}</div>
    </div>
    <div style="padding:18px;border:1px solid #d0d7e2;border-top:none;border-radius:0 0 8px 8px">
      <p>Dear Resident,</p>
      <p>Please find attached the financial report of Aditya Classic Association for <b>${year}</b>.</p>
      ${body.message?.trim() ? `<p style="white-space:pre-line">${esc(body.message.trim())}</p>` : ''}
      ${s ? `<table cellspacing="8" style="width:100%"><tr>
        ${card('COLLECTED', s.collected, '#2e7d32')}${card('USED', s.used, '#c62828')}
        ${card('SAVINGS', s.savings, s.savings >= 0 ? '#2e7d32' : '#c62828')}</tr></table>` : ''}
      <p>Regards,<br>Aditya Classic Association</p>
    </div>
  </div>`;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
