import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { ToastService } from './toast.service';
import { AuthService, Role } from './auth.service';

// localStorage keys that hold app data; each becomes one sheet in the workbook.
export const DATA_KEYS = [
  'people',
  'maintenanceData',
  'utilityData',
  'miscellaneous',
  'guards',
  'salaryData',
  'commonItems',
];

// Nested { year: { name: { month: amount } } } keys, flattened to rows in Excel.
// The value is the column name used for the middle level.
const NESTED_KEYS: Record<string, string> = {
  maintenanceData: 'person',
  salaryData: 'guard',
  utilityData: 'type',
};

const API_URL = '/.netlify/functions/data';
const SAVE_DELAY_MS = 1500;

// Same SHA-256 hashes the server checks. Used only when the server can't be reached
// (offline or `ng serve`); the server stays the real gate for loading and saving cloud data.
const OFFLINE_ROLE_HASHES: Record<string, Role> = {
  '768c5aebaedd7dd4a97bf64af5f26067d75e4e61e884bdbca3742ccc7c4ceecc': 'admin',
  '84983c60f7daadc1cb8698621f802c0d9f9a3c3c295c810748fb048115c186ec': 'guest',
};

@Injectable({ providedIn: 'root' })
export class CloudSyncService {
  // False when the sync function is unreachable (e.g. `ng serve`); saves are skipped.
  private enabled = false;
  private applying = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private toast: ToastService, private auth: AuthService) {}

  /** Runs before the app starts: sets up auto-save and restores the login after a page refresh. */
  async init(): Promise<void> {
    // Drop the data key used by the earlier login-less version.
    localStorage.removeItem('acmtSyncKey');
    this.watchLocalStorage();
    window.addEventListener('pagehide', () => this.flush());

    const saved = this.auth.savedPassword();
    if (saved) {
      try {
        await this.login(saved);
      } catch {
        // Password no longer valid: show the login screen.
        this.auth.clearSession();
      }
    }
  }

  /**
   * Checks the password with the server and loads the cloud workbook into localStorage.
   * Throws with a user-facing message if the password is wrong.
   */
  async login(password: string): Promise<void> {
    let res: Response | null = null;
    try {
      res = await this.request('GET', undefined, false, { 'x-acmt-password': password });
    } catch {
      res = null; // offline
    }
    if (res?.status === 401) throw new Error('Wrong password');

    const role = res?.headers.get('x-acmt-role') as Role | null;
    if (!res || !role) {
      // Server unreachable (offline or dev server): check locally, work from this device's data.
      const offlineRole = await this.offlineRole(password);
      if (!offlineRole) throw new Error('Wrong password');
      this.auth.setSession(offlineRole, password);
      this.toast.showToast('Could not reach the cloud; showing data saved on this device', 6000, 'error');
      return;
    }

    this.auth.setSession(role, password);
    this.enabled = true;
    if (res.status === 404) {
      // Nothing in the cloud yet: an admin uploads whatever this device already has.
      if (role === 'admin') await this.save();
      return;
    }
    if (!res.ok) {
      this.toast.showToast('Could not load data from cloud; showing data saved on this device', 6000, 'error');
      return;
    }
    this.applyWorkbook(await res.arrayBuffer(), false);
  }

  private async offlineRole(password: string): Promise<Role | null> {
    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
      const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      return OFFLINE_ROLE_HASHES[hex] ?? null;
    } catch {
      return null;
    }
  }

  /** Builds the workbook from the app data in localStorage. */
  buildWorkbook(): XLSX.WorkBook {
    const wb = XLSX.utils.book_new();
    for (const key of DATA_KEYS) {
      let parsed: any;
      try {
        parsed = JSON.parse(localStorage.getItem(key) || 'null');
      } catch {
        parsed = null;
      }
      let rows: any[];
      if (NESTED_KEYS[key]) {
        rows = [];
        const col = NESTED_KEYS[key];
        Object.entries(parsed || {}).forEach(([year, namesObj]: [string, any]) => {
          Object.entries(namesObj || {}).forEach(([name, monthsObj]: [string, any]) => {
            Object.entries(monthsObj || {}).forEach(([month, amount]) => {
              rows.push({ year, [col]: name, month, amount });
            });
          });
        });
      } else {
        rows = Array.isArray(parsed) ? parsed : [];
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), key);
    }
    return wb;
  }

  /**
   * Writes the workbook's sheets into localStorage.
   * `persist` uploads the result to the cloud (used for manual Excel imports).
   */
  applyWorkbook(data: ArrayBuffer, persist = true): string[] {
    const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
    const imported: string[] = [];
    this.applying = !persist;
    try {
      workbook.SheetNames.forEach(sheetName => {
        if (!DATA_KEYS.includes(sheetName)) return;
        const json: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
        let value: any = json;
        if (NESTED_KEYS[sheetName]) {
          // accept the older 'person'/'category' column names too
          const col = NESTED_KEYS[sheetName];
          const nested: any = {};
          json.forEach(row => {
            const name = row[col] ?? row.person ?? row.category;
            if (!row.year || !name || !row.month) return;
            const month = String(row.month).padStart(2, '0');
            nested[row.year] ??= {};
            nested[row.year][name] ??= {};
            nested[row.year][name][month] = row.amount || 0;
          });
          value = nested;
        }
        localStorage.setItem(sheetName, JSON.stringify(value));
        imported.push(`${sheetName}: ${json.length} rows`);
      });
    } finally {
      this.applying = false;
    }
    return imported;
  }

  /** Saves the current data to the cloud now. */
  async save(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (!this.enabled || !this.auth.canEdit()) return;
    try {
      const res = await this.request('PUT', this.workbookBytes());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      console.error('Cloud save failed', e);
      this.toast.showToast('Cloud save failed; changes are kept on this device', 6000, 'error');
    }
  }

  /**
   * Deletes the cloud workbook and all backups, then wipes this device's storage,
   * so the app starts like a brand-new install.
   * Throws with a user-facing message if the password is wrong or the cloud is unreachable.
   */
  async clearAllData(password: string): Promise<void> {
    if (!this.auth.canEdit()) throw new Error('Only the admin can clear data.');
    if (!this.enabled) throw new Error('Clearing data needs the cloud connection. Check your internet and reload.');
    // Stop any pending upload so old data isn't saved back after the delete.
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.enabled = false;
    let res: Response;
    try {
      res = await this.request('DELETE', undefined, false, { 'x-acmt-reset-password': password });
    } catch {
      this.enabled = true;
      throw new Error('Could not reach the server. Nothing was deleted.');
    }
    if (!res.ok) {
      this.enabled = true;
      throw new Error(res.status === 403 ? 'Wrong password. Nothing was deleted.' : `Delete failed (HTTP ${res.status}).`);
    }
    localStorage.clear();
    sessionStorage.clear();
  }

  private scheduleSave() {
    if (!this.enabled || !this.auth.canEdit()) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), SAVE_DELAY_MS);
  }

  // Send a pending save before the tab closes.
  private flush() {
    if (!this.saveTimer || !this.enabled) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.request('PUT', this.workbookBytes(), true).catch(() => {});
  }

  // Every component saves with localStorage.setItem, so hooking it here
  // gives auto-save without touching each component.
  private watchLocalStorage() {
    const original = Storage.prototype.setItem;
    const sync = this;
    Storage.prototype.setItem = function (key: string, value: string) {
      const isUserEdit = this === localStorage && !sync.applying && DATA_KEYS.includes(key);
      // Guests are read-only: ignore any data write that slips past the UI.
      if (isUserEdit && !sync.auth.canEdit()) return;
      original.call(this, key, value);
      if (isUserEdit) sync.scheduleSave();
    };
  }

  private workbookBytes(): ArrayBuffer {
    return XLSX.write(this.buildWorkbook(), { bookType: 'xlsx', type: 'array' });
  }

  private request(
    method: 'GET' | 'PUT' | 'DELETE',
    body?: ArrayBuffer,
    keepalive = false,
    extraHeaders: Record<string, string> = {},
  ): Promise<Response> {
    return fetch(API_URL, {
      method,
      body,
      keepalive,
      cache: 'no-store',
      headers: { 'x-acmt-password': this.auth.password, ...extraHeaders },
      signal: keepalive ? undefined : AbortSignal.timeout(10000),
    });
  }
}
