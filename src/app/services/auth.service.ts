import { Injectable, computed, signal } from '@angular/core';

export type Role = 'admin' | 'guest';

const SESSION_KEY = 'acmtSession';
/** localStorage key (and Excel sheet) holding the admin's details: [{ email }]. Synced like other data. */
export const ADMIN_PROFILE_KEY = 'adminProfile';

/**
 * Who is logged in. Kept in sessionStorage, so a page refresh stays logged in,
 * but closing the tab or browser asks for the password again.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly role = signal<Role | null>(null);
  readonly loggedIn = computed(() => this.role() !== null);
  /** Guests can view data but not change it. */
  readonly canEdit = computed(() => this.role() === 'admin');
  readonly readOnly = computed(() => this.role() === 'guest');
  /** The admin's email, shared across devices through the synced data. */
  readonly adminEmail = signal<string | null>(null);
  /** True when an admin is logged in but no admin email has been saved yet. */
  readonly needsAdminEmail = computed(() => this.canEdit() && !this.adminEmail());

  password = '';

  loadAdminEmail() {
    try {
      const rows = JSON.parse(localStorage.getItem(ADMIN_PROFILE_KEY) || '[]');
      this.adminEmail.set((Array.isArray(rows) && rows[0]?.email) || null);
    } catch {
      this.adminEmail.set(null);
    }
  }

  /** Saves the admin email; the write is picked up by auto-save and uploaded. */
  saveAdminEmail(email: string) {
    localStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify([{ email }]));
    this.adminEmail.set(email);
  }

  setSession(role: Role, password: string) {
    this.password = password;
    this.role.set(role);
    try {
      sessionStorage.setItem(SESSION_KEY, password);
    } catch {
      // Storage blocked: the session just won't survive a refresh.
    }
  }

  /** Password saved by an earlier login in this tab, if any. */
  savedPassword(): string | null {
    try {
      return sessionStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  }

  clearSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {}
  }

  logout() {
    this.clearSession();
    // Reload so every page drops its data and the login screen shows.
    window.location.href = '/';
  }
}
