import nodemailer from 'nodemailer';
import { SMTP_PASS_KEY, dataStore, roleFor, savedAdminEmail, smtpPassword } from '../lib/auth.mts';

// Admin-only email setup, so the Gmail App Password can be saved from the app instead of Netlify's settings.
// GET    -> { adminEmail, configured, source: 'netlify' | 'app' | null }   (the password itself is never returned)
// PUT    { password } -> tests the login with Gmail; saves it only if Gmail accepts it
// DELETE -> removes the password saved from the app

export default async (req: Request) => {
  if (roleFor(req) !== 'admin') return json({ error: 'Only the admin can change email settings' }, 403);
  const adminEmail = await savedAdminEmail();

  if (req.method === 'GET') {
    const { source } = await smtpPassword();
    return json({ adminEmail, configured: source !== null, source });
  }

  if (req.method === 'PUT') {
    if (!adminEmail) return json({ error: 'Save the admin email first (shown in the header next to Log out).' }, 400);
    let password = '';
    try {
      password = String((await req.json())?.password ?? '').replace(/\s+/g, '');
    } catch {}
    if (!password) return json({ error: 'Enter the App Password' }, 400);

    // Check with Gmail before saving, so a wrong password is caught now rather than at send time.
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: adminEmail, pass: password } });
    try {
      await transporter.verify();
    } catch (e: any) {
      const auth = e?.code === 'EAUTH' || e?.responseCode === 535;
      return json({
        error: auth
          ? `Gmail rejected this password for ${adminEmail}. Gmail does not accept the normal account password here: ` +
            'turn on 2-Step Verification, then create an App Password at myaccount.google.com/apppasswords and use that.'
          : 'Could not reach Gmail to check the password. Please try again.',
      }, 400);
    }
    await dataStore().set(SMTP_PASS_KEY, password);
    return json({ adminEmail, configured: true, source: 'app' });
  }

  if (req.method === 'DELETE') {
    await dataStore().delete(SMTP_PASS_KEY);
    const { source } = await smtpPassword();
    return json({ adminEmail, configured: source !== null, source });
  }

  return json({ error: 'Method not allowed' }, 405);
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
