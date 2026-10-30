import { Injectable, signal } from '@angular/core';
import { KN } from './kn';
import { toKannada } from './transliterate';
import { englishToKannada } from './english-words';
import { AutoTranslateService } from './auto-translate.service';

export type Language = 'en' | 'kn';

// Kept on this device only; cloud sync copies just the data keys.
const STORAGE_KEY = 'language';
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The language the app is shown in. English text is the key: `t('Save')` gives the
 * Kannada for "Save" when Kannada is on, and the English text when it is off or untranslated.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly lang = signal<Language>(this.saved());

  constructor(private auto: AutoTranslateService) {
    document.documentElement.lang = this.lang();
  }

  set(lang: Language) {
    this.lang.set(lang);
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Storage blocked: the choice just won't be remembered.
    }
  }

  toggle() {
    this.set(this.lang() === 'kn' ? 'en' : 'kn');
  }

  /** Translates `text`, then fills `{name}` placeholders from `params`. */
  t(text: string, params?: Record<string, unknown>): string {
    const out = this.lang() === 'kn' ? KN[text] ?? text : text;
    if (!params) return out;
    return out.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
  }

  /** "30 Oct 2026", with the month in the current language. */
  shortDate(date: Date): string {
    return `${date.getDate()} ${this.t(SHORT_MONTHS[date.getMonth()])} ${date.getFullYear()}`;
  }

  /**
   * A person's name in the current language: their saved Kannada spelling, else Claude's spelling,
   * else (until that arrives) one spelled from the English letters.
   */
  name(name: string, nameKn?: string): string {
    if (this.lang() !== 'kn' || !name) return name;
    return nameKn?.trim() || this.auto.get(name, 'name') || toKannada(name);
  }

  /** The Kannada spelling a name gets when none is saved, without asking for a new one. */
  suggestedName(name: string): string {
    return this.auto.peek(name, 'name') ?? toKannada(name.trim());
  }

  /**
   * Text someone typed (an item, an expense) in the current language: a saved correction, else Claude's
   * translation, else (until that arrives, or if it isn't set up) a word-by-word Kannada spelling.
   */
  text(text: string, textKn?: string): string {
    if (this.lang() !== 'kn' || !text) return text;
    return textKn?.trim() || this.auto.get(text, 'text') || englishToKannada(text);
  }

  private saved(): Language {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'kn' ? 'kn' : 'en';
    } catch {
      return 'en';
    }
  }
}
