import { Pipe, PipeTransform } from '@angular/core';
import { LanguageService } from './language.service';

/** `{{ item.desc | userText: item.descKn }}`: text someone typed, translated when Kannada is on. */
@Pipe({ name: 'userText', pure: false })
export class UserTextPipe implements PipeTransform {
  constructor(private i18n: LanguageService) {}

  transform(text: string, textKn?: string): string {
    return this.i18n.text(text, textKn);
  }
}
