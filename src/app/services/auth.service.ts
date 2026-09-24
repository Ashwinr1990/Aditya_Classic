import { Injectable, computed, signal } from '@angular/core';

export type Role = 'admin' | 'guest';

const SESSION_KEY = 'acmtSession';

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

  password = '';

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
