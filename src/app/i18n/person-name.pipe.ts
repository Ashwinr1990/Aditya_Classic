import { Pipe, PipeTransform } from '@angular/core';
import { LanguageService } from './language.service';

/** `{{ person.name | personName: person.nameKn }}`: the name in Kannada when Kannada is on. */
@Pipe({ name: 'personName', pure: false })
export class PersonNamePipe implements PipeTransform {
  constructor(private i18n: LanguageService) {}

  transform(name: string, nameKn?: string): string {
    return this.i18n.name(name, nameKn);
  }
}
