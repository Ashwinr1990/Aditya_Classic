import { Component } from '@angular/core';
import { promptPassword } from '../../password-util';

@Component({
  selector: 'app-add',
  imports: [],
  templateUrl: './add.html',
  styleUrl: './add.scss',
})
export class Add {
  async protectedAction() {
    if (!(await promptPassword())) {
      alert('Incorrect password. Action cancelled.');
      return;
    }
    // Place add/save logic here
  }
}
