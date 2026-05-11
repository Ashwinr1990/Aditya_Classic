import { Component } from '@angular/core';
import { promptPassword } from '../../password-util';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-list',
  imports: [NgFor, NgIf, FormsModule],
  templateUrl: './list.html',
  styleUrl: './list.scss',
})
export class List {
  people: { name: string; unit: string }[] = [];
  showDialog = false;
  newPerson = { name: '', unit: '' };

  constructor() {
    this.loadPeople();
  }

  openDialog() {
    this.showDialog = true;
    this.newPerson = { name: '', unit: '' };
  }

  closeDialog() {
    this.showDialog = false;
  }

  async addPerson() {
    if (!(await promptPassword())) {
      alert('Incorrect password. Action cancelled.');
      return;
    }
    if (this.newPerson.name.trim() && this.newPerson.unit.trim()) {
      this.people.push({ ...this.newPerson });
      this.savePeople();
      this.newPerson = { name: '', unit: '' };
      this.showDialog = false;
    }
  }

  async savePeople() {
    if (await promptPassword()) {
      localStorage.setItem('people', JSON.stringify(this.people));
    } else {
      alert('Incorrect password. Action cancelled.');
    }
  }

  loadPeople() {
    const data = localStorage.getItem('people');
    this.people = data ? JSON.parse(data) : [];
  }
}
