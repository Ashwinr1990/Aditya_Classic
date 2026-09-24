import { getStore } from '@netlify/blobs';
import { createHash, timingSafeEqual } from 'node:crypto';

// Stores the whole app data set as one Excel workbook in Netlify Blobs.
// Every request sends the login password in the `x-acmt-password` header:
//   admin -> may read, save and delete;  guest -> may only read.
// GET    /.netlify/functions/data  -> the workbook (404 if nothing saved yet),
//                                     with the caller's role in `x-acmt-role`
// PUT    /.netlify/functions/data  -> replace the workbook (admin)
// DELETE /.netlify/functions/data  -> delete the workbook and all backups
//                                     (admin, plus the `x-acmt-reset-password` header)

type Role = 'admin' | 'guest';

const FILE_KEY = 'ACMT-Data.xlsx';
const MAX_BYTES = 5 * 1024 * 1024;
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// SHA-256 of each password, so the passwords themselves aren't stored in the code.
const ROLE_PASSWORD_SHA256: Record<Role, string> = {
  admin: '768c5aebaedd7dd4a97bf64af5f26067d75e4e61e884bdbca3742ccc7c4ceecc',
  guest: '84983c60f7daadc1cb8698621f802c0d9f9a3c3c295c810748fb048115c186ec',
};
const RESET_PASSWORD_SHA256 = '446e91f0f78ae7b2e36c8cca141db3a36a1cb9eddd13560938e46a9d152ea3fb';

function matchesHash(value: string | null, hexHash: string): boolean {
  const given = createHash('sha256').update(value ?? '').digest();
  return timingSafeEqual(given, Buffer.from(hexHash, 'hex'));
}

function roleFor(req: Request): Role | null {
  const password = req.headers.get('x-acmt-password');
  if (matchesHash(password, ROLE_PASSWORD_SHA256.admin)) return 'admin';
  if (matchesHash(password, ROLE_PASSWORD_SHA256.guest)) return 'guest';
  return null;
}

export default async (req: Request) => {
  const role = roleFor(req);
  if (!role) return new Response('Wrong password', { status: 401 });
  const roleHeader = { 'x-acmt-role': role, 'Cache-Control': 'no-store' };

  const store = getStore({ name: 'acmt', consistency: 'strong' });

  if (req.method === 'GET') {
    const data = await store.get(FILE_KEY, { type: 'arrayBuffer' });
    if (!data) return new Response('No data saved yet', { status: 404, headers: roleHeader });
    return new Response(data, { headers: { ...roleHeader, 'Content-Type': XLSX_TYPE } });
  }

  if (role !== 'admin') return new Response('Read-only access', { status: 403, headers: roleHeader });

  if (req.method === 'PUT') {
    const body = await req.arrayBuffer();
    if (body.byteLength === 0 || body.byteLength > MAX_BYTES) {
      return new Response('Invalid file size', { status: 400 });
    }
    await store.set(FILE_KEY, body);
    // One backup per day, so a bad save can be rolled back.
    const day = new Date().toISOString().slice(0, 10);
    await store.set(`backups/${day}.xlsx`, body);
    return new Response(null, { status: 204 });
  }

  if (req.method === 'DELETE') {
    if (!matchesHash(req.headers.get('x-acmt-reset-password'), RESET_PASSWORD_SHA256)) {
      return new Response('Wrong password', { status: 403 });
    }
    const { blobs } = await store.list();
    await Promise.all(blobs.map(b => store.delete(b.key)));
    return new Response(null, { status: 204 });
  }

  return new Response('Method not allowed', { status: 405 });
};
