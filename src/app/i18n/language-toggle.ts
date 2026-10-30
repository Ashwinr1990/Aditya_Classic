import { Component } from '@angular/core';
import { LanguageService } from './language.service';

/** Switches the app between English and Kannada. Each language is named in its own script. */
@Component({
  selector: 'app-language-toggle',
  template: `
    <button type="button" class="lang-toggle" (click)="i18n.toggle()"
            [attr.lang]="i18n.lang() === 'kn' ? 'en' : 'kn'"
            [title]="i18n.lang() === 'kn' ? 'Switch to English' : 'ಕನ್ನಡಕ್ಕೆ ಬದಲಿಸಿ'">
      {{ i18n.lang() === 'kn' ? 'English' : 'ಕನ್ನಡ' }}
    </button>
  `,
  styles: `
    .lang-toggle {
      background: #fff;
      color: #1976d2;
      border: 1.5px solid #fff;
      border-radius: 1rem;
      padding: 0.2rem 0.75rem;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    .lang-toggle:hover {
      background: #e3f2fd;
    }
  `,
})
export class LanguageToggle {
  constructor(public i18n: LanguageService) {}
}
