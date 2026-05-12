import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  show = false;
  message = '';
  type: 'info' | 'success' | 'error' = 'info';

  showToast(message: string, duration = 5000, type: 'info' | 'success' | 'error' = 'info') {
    this.message = message;
    this.type = type;
    this.show = true;
    setTimeout(() => {
      this.show = false;
    }, duration);
  }
}
