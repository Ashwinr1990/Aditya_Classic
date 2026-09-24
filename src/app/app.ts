import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ToastService } from './services/toast.service';
import { AuthService } from './services/auth.service';
import { Login } from './login/login';
import { AdminEmailPrompt } from './admin-email/admin-email-prompt';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Login, AdminEmailPrompt],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('ACMT');
  showNav = signal(false);
  // Inline edit of the admin email in the header
  editingEmail = signal(false);

  constructor(public toast: ToastService, public auth: AuthService) {}

  startEditEmail() {
    this.editingEmail.set(true);
    // Focus and select the address once the input has rendered
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('.email-edit input');
      input?.focus();
      input?.select();
    });
  }

  saveAdminEmail(value: string) {
    const email = value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.toast.showToast('Please enter a valid email address', 4000, 'error');
      return;
    }
    if (email !== this.auth.adminEmail()) {
      this.auth.saveAdminEmail(email);
      this.toast.showToast('Admin email updated', 4000, 'success');
    }
    this.editingEmail.set(false);
  }
  private navKeyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.closeNav();
      return;
    }
    if (e.key !== 'Tab') return;
    const container = document.querySelector('.main-nav') as HTMLElement | null;
    if (!container) return;
    const focusable = Array.from(container.querySelectorAll('a, button')).filter(el => (el as HTMLElement).offsetParent !== null) as HTMLElement[];
    if (focusable.length === 0) return;
    const active = document.activeElement as HTMLElement;
    let idx = focusable.indexOf(active);
    if (e.shiftKey) {
      idx = idx <= 0 ? focusable.length - 1 : idx - 1;
    } else {
      idx = idx === focusable.length - 1 ? 0 : idx + 1;
    }
    e.preventDefault();
    focusable[idx].focus();
  }

  toggleNav() {
    const next = !this.showNav();
    this.showNav.set(next);
    if (next) {
      // open: add listener and focus first item
      setTimeout(() => {
        const first = document.querySelector('.main-nav a') as HTMLElement | null;
        first?.focus();
      }, 80);
      document.addEventListener('keydown', this.navKeyHandler);
    } else {
      document.removeEventListener('keydown', this.navKeyHandler);
    }
  }
  closeNav() {
    this.showNav.set(false);
    document.removeEventListener('keydown', this.navKeyHandler);
  }
}
