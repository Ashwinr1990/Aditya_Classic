import { Pipe, PipeTransform } from '@angular/core';
import { LanguageService } from './language.service';

/** `{{ 'Save' | t }}` or `{{ 'Search in {column}' | t: { column: c } }}`. Impure so it follows language changes. */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  constructor(private i18n: LanguageService) {}

  transform(text: string, params?: Record<string, unknown>): string {
    return this.i18n.t(text, params);
  }
}
