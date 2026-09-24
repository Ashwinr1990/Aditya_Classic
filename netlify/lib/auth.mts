import { getStore } from '@netlify/blobs';
import { createHash, timingSafeEqual } from 'node:crypto';

// Shared by the Netlify functions. Lives outside netlify/functions so it isn't deployed as a function.

export type Role = 'admin' | 'guest';

/** Blob key of the app's data workbook. */
export const FILE_KEY = 'ACMT-Data.xlsx';

// SHA-256 of each password, so the passwords themselves aren't stored in the code.
const ROLE_PASSWORD_SHA256: Record<Role, string> = {
  admin: '768c5aebaedd7dd4a97bf64af5f26067d75e4e61e884bdbca3742ccc7c4ceecc',
  guest: '84983c60f7daadc1cb8698621f802c0d9f9a3c3c295c810748fb048115c186ec',
};
export const RESET_PASSWORD_SHA256 = '446e91f0f78ae7b2e36c8cca141db3a36a1cb9eddd13560938e46a9d152ea3fb';

export function matchesHash(value: string | null, hexHash: string): boolean {
  const given = createHash('sha256').update(value ?? '').digest();
  return timingSafeEqual(given, Buffer.from(hexHash, 'hex'));
}

/** Role for the `x-acmt-password` header, or null if the password is wrong. */
export function roleFor(req: Request): Role | null {
  const password = req.headers.get('x-acmt-password');
  if (matchesHash(password, ROLE_PASSWORD_SHA256.admin)) return 'admin';
  if (matchesHash(password, ROLE_PASSWORD_SHA256.guest)) return 'guest';
  return null;
}

export function dataStore() {
  return getStore({ name: 'acmt', consistency: 'strong' });
}
