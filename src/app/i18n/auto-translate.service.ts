import { Injectable, signal } from '@angular/core';
import { AuthService } from '../services/auth.service';

/** 'name': a person's name, spelled in Kannada. 'text': an item or expense someone typed, translated. */
export type TextKind = 'name' | 'text';

const API_URL = '/.netlify/functions/translate';
// Answers already fetched on this device, so pages show Kannada straight away next time.
// Not a synced data key: guests keep their own copy too.
const CACHE_KEY = 'translationCache';
// Matches the server's limit per request
const BATCH_SIZE = 8;
const DELAY_MS = 200;

/**
 * Kannada for text people typed in English, from the `translate` Netlify function (Claude).
 * Texts are requested the first time a page shows them in Kannada, in small batches.
 */
@Injectable({ providedIn: 'root' })
export class AutoTranslateService {
  /** True once the server has said it has no API key; no more requests are sent. */
  readonly setupNeeded = signal(false);
  // Bumped when answers arrive, so pages showing them redraw
  private readonly version = signal(0);
  private cache: Record<string, string> = readCache();
  private queue = new Map<string, { kind: TextKind; text: string }>();
  // Asked for this session, answered or not, so a failure isn't retried on every redraw
  private asked = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private busy = false;

  constructor(private auth: AuthService) {}

  /** The Kannada for `text`, or undefined while it is being translated. Text with no English letters is returned as is. */
  get(text: string, kind: TextKind): string | undefined {
    this.version();
    const trimmed = text.trim();
    if (!/[A-Za-z]/.test(trimmed)) return text;
    const key = `${kind}:${trimmed}`;
    const known = this.cache[key];
    if (known !== undefined) return known;
    if (!this.asked.has(key) && !this.setupNeeded() && this.auth.loggedIn()) {
      this.asked.add(key);
      this.queue.set(key, { kind, text: trimmed });
      this.schedule();
    }
    return undefined;
  }

  /** Like `get`, but never sends a request. */
  peek(text: string, kind: TextKind): string | undefined {
    return this.cache[`${kind}:${text.trim()}`];
  }

  private schedule() {
    if (!this.timer && !this.busy) this.timer = setTimeout(() => this.flush(), DELAY_MS);
  }

  private async flush() {
    this.timer = null;
    const batch = [...this.queue.entries()].slice(0, BATCH_SIZE);
    if (batch.length === 0) return;
    batch.forEach(([key]) => this.queue.delete(key));
    this.busy = true;
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-acmt-password': this.auth.password },
        body: JSON.stringify({ items: batch.map(([, item]) => item) }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data?.translations)) {
        batch.forEach(([key], i) => {
          const kannada = data.translations[i];
          if (typeof kannada === 'string' && kannada) this.cache[key] = kannada;
        });
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(this.cache));
        } catch {}
        this.version.update(v => v + 1);
      } else if (data?.setupNeeded) {
        this.queue.clear();
        this.setupNeeded.set(true);
      }
    } catch {
      // Offline or no functions (dev server): pages keep showing the fallback text.
    } finally {
      this.busy = false;
      if (this.queue.size > 0) this.schedule();
    }
  }
}

function readCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}
