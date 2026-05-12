import { Component } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../services/toast.service';

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

  constructor(private toast: ToastService) {
    this.loadPeople();
  }

  openDialog() {
    this.showDialog = true;
    this.newPerson = { name: '', unit: '' };
  }

  closeDialog() {
    this.showDialog = false;
  }

  addPerson() {
    if (this.newPerson.name.trim() && this.newPerson.unit.trim()) {
      this.people.push({ ...this.newPerson });
      this.savePeople();
      this.newPerson = { name: '', unit: '' };
      this.showDialog = false;
    }
  }

  savePeople() {
    localStorage.setItem('people', JSON.stringify(this.people));
    this.toast.showToast('Saved people', 5000, 'success');
  }

  loadPeople() {
    const data = localStorage.getItem('people');
    this.people = data ? JSON.parse(data) : [];
  }
}
