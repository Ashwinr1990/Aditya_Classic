import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

/** Asks a logged-in admin for their email when none has been saved yet. */
@Component({
  selector: 'app-admin-email-prompt',
  imports: [FormsModule],
  template: `
    @if (auth.needsAdminEmail() && !dismissed()) {
      <div class="backdrop">
        <form class="card" (ngSubmit)="save()" role="dialog" aria-labelledby="admin-email-title">
          <h3 id="admin-email-title">Add admin email</h3>
          <p>No email is saved for the admin yet. Enter it once and it will be saved with the association's data.</p>
          <label>
            Admin email
            <input
              type="email"
              name="adminEmail"
              [(ngModel)]="email"
              placeholder="admin@example.com"
              autocomplete="email"
              autofocus
              required
            />
          </label>
          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }
          <div class="actions">
            <button type="button" class="secondary" (click)="dismissed.set(true)">Later</button>
            <button type="submit" [disabled]="!email.trim()">Save</button>
          </div>
        </form>
      </div>
    }
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      background: #0008;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      z-index: 2000;
    }
    .card {
      background: #fff;
      border-radius: 1rem;
      padding: 1.5rem;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 8px 32px #0004;
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
    }
    h3 {
      margin: 0;
      color: #1976d2;
    }
    p {
      margin: 0;
      color: #555;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      font-weight: 600;
      color: #333;
    }
    input {
      padding: 0.6rem 0.75rem;
      border-radius: 0.5rem;
      border: 1.5px solid #1976d2;
      font-size: 1rem;
    }
    .error {
      color: #c62828;
      font-weight: 600;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }
    button {
      padding: 0.55rem 1.4rem;
      border-radius: 0.75rem;
      border: none;
      background: #1976d2;
      color: #fff;
      font-weight: bold;
      cursor: pointer;
    }
    button.secondary {
      background: #eee;
      color: #333;
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `,
})
export class AdminEmailPrompt {
  email = '';
  error = signal('');
  // "Later" hides the prompt until the next login
  dismissed = signal(false);

  constructor(public auth: AuthService, private toast: ToastService) {}

  save() {
    const email = this.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.error.set('Please enter a valid email address.');
      return;
    }
    this.auth.saveAdminEmail(email);
    this.toast.showToast('Admin email saved', 4000, 'success');
  }
}
