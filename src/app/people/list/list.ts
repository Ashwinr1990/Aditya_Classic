import { Component } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';

type Person = { name: string; unit: string; email?: string };
// { [year]: { [personName]: { [month]: amount } } } — shared with the Maintenance page and dashboard
type MaintenanceData = Record<string, Record<string, Record<string, number>>>;

@Component({
  selector: 'app-list',
  imports: [NgFor, NgIf, FormsModule],
  templateUrl: './list.html',
  styleUrl: './list.scss',
})
export class List {
  people: Person[] = [];
  showDialog = false;
  newPerson: Person = { name: '', unit: '', email: '' };
  // Index of the person being edited, or null when adding
  editIndex: number | null = null;
  dialogError = '';

  constructor(public auth: AuthService, private toast: ToastService) {
    this.loadPeople();
  }

  openDialog() {
    this.editIndex = null;
    this.newPerson = { name: '', unit: '', email: '' };
    this.dialogError = '';
    this.showDialog = true;
  }

  openEdit(index: number) {
    this.editIndex = index;
    this.newPerson = { email: '', ...this.people[index] };
    this.dialogError = '';
    this.showDialog = true;
  }

  closeDialog() {
    this.showDialog = false;
    this.editIndex = null;
  }

  savePerson() {
    const person: Person = {
      name: this.newPerson.name.trim(),
      unit: this.newPerson.unit.trim(),
      email: (this.newPerson.email ?? '').trim(),
    };
    if (!person.name || !person.unit) return;
    if (person.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email)) {
      this.dialogError = 'Please enter a valid email address.';
      return;
    }

    // Maintenance amounts are stored by name, so names must be unique.
    const duplicate = this.people.some(
      (p, i) => i !== this.editIndex && p.name.toLowerCase() === person.name.toLowerCase()
    );
    if (duplicate) {
      this.dialogError = `A person named "${person.name}" already exists.`;
      return;
    }

    if (this.editIndex === null) {
      this.people.push(person);
      this.savePeople('Person added');
    } else {
      const oldName = this.people[this.editIndex].name;
      this.people[this.editIndex] = person;
      if (oldName !== person.name) this.renameInMaintenance(oldName, person.name);
      this.savePeople('Person updated');
    }
    this.closeDialog();
  }

  deletePerson(index: number) {
    const person = this.people[index];
    const ok = window.confirm(
      `Delete ${person.name} (${person.unit})?\n\nTheir maintenance payments for all years will also be deleted. This cannot be undone.`
    );
    if (!ok) return;
    this.people.splice(index, 1);
    this.removeFromMaintenance(person.name);
    this.savePeople('Person deleted');
  }

  savePeople(message = 'Saved people') {
    localStorage.setItem('people', JSON.stringify(this.people));
    this.toast.showToast(message, 5000, 'success');
  }

  loadPeople() {
    const data = localStorage.getItem('people');
    this.people = data ? JSON.parse(data) : [];
  }

  // Move a person's maintenance amounts to their new name in every year.
  private renameInMaintenance(oldName: string, newName: string) {
    const data = this.loadMaintenance();
    for (const year of Object.keys(data)) {
      if (!data[year][oldName]) continue;
      data[year][newName] = data[year][oldName];
      delete data[year][oldName];
    }
    this.saveMaintenance(data);
  }

  // Remove a person's maintenance amounts from every year.
  private removeFromMaintenance(name: string) {
    const data = this.loadMaintenance();
    for (const year of Object.keys(data)) {
      delete data[year][name];
    }
    this.saveMaintenance(data);
  }

  private loadMaintenance(): MaintenanceData {
    const data = localStorage.getItem('maintenanceData');
    return data ? JSON.parse(data) : {};
  }

  private saveMaintenance(data: MaintenanceData) {
    localStorage.setItem('maintenanceData', JSON.stringify(data));
  }
}
