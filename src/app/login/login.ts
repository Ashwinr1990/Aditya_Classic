import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CloudSyncService } from '../services/cloud-sync.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="login-page">
      <form class="login-card" (ngSubmit)="submit()">
        <h1>Aditya Classic Association</h1>
        <p>Enter the password to open the app.</p>
        <label>
          Password
          <input
            type="password"
            name="password"
            [(ngModel)]="password"
            autocomplete="current-password"
            autofocus
            required
          />
        </label>
        @if (error()) {
          <p class="login-error" role="alert">{{ error() }}</p>
        }
        <button type="submit" [disabled]="busy() || !password">
          {{ busy() ? 'Checking...' : 'Open' }}
        </button>
      </form>
    </div>
  `,
  styles: `
    .login-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;
      background: linear-gradient(135deg, #e3f2fd, #e8f5e9);
    }
    .login-card {
      background: #fff;
      border-radius: 1rem;
      box-shadow: 0 8px 32px #0002;
      padding: 2rem 1.5rem;
      width: 100%;
      max-width: 380px;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    h1 {
      margin: 0;
      font-size: 1.5rem;
      color: #1976d2;
      text-align: center;
    }
    p {
      margin: 0;
      color: #555;
      text-align: center;
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
    button {
      padding: 0.7rem;
      border-radius: 0.75rem;
      border: none;
      background: linear-gradient(90deg, #1976d2 60%, #388e3c 100%);
      color: #fff;
      font-weight: bold;
      font-size: 1.05rem;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .login-error {
      color: #c62828;
      font-weight: 600;
    }
  `,
})
export class Login {
  password = '';
  error = signal('');
  busy = signal(false);

  constructor(
    private cloudSync: CloudSyncService,
    private auth: AuthService,
    private router: Router,
  ) {}

  async submit() {
    if (!this.password || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.cloudSync.login(this.password);
      // Guests only get the dashboard, even if the app was opened on another page.
      if (this.auth.readOnly() && this.router.url !== '/') {
        await this.router.navigateByUrl('/');
      }
    } catch (e: any) {
      this.error.set(e?.message ?? 'Login failed');
      this.busy.set(false);
    }
  }
}
