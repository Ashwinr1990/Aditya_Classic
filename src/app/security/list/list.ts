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
  guards: { name: string }[] = [{ name: 'Ramesh' }];
  selectedYear = new Date().getFullYear();
  months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  // Data structure: { [year]: { [guardName]: { [month]: amount } } }
  salaryData: Record<string, Record<string, Record<string, number>>> = {};

  constructor() {
    this.loadGuards();
    this.loadSalaries();
  }

  loadGuards() {
    const data = localStorage.getItem('guards');
    this.guards = data ? JSON.parse(data) : [{ name: 'Ramesh' }];
  }

  async saveGuards() {
    if (await promptPassword()) {
      localStorage.setItem('guards', JSON.stringify(this.guards));
    } else {
      alert('Incorrect password. Action cancelled.');
    }
  }

  loadSalaries() {
    const data = localStorage.getItem('salaryData');
    this.salaryData = data ? JSON.parse(data) : {};
  }

  async saveSalaries() {
    if (await promptPassword()) {
      localStorage.setItem('salaryData', JSON.stringify(this.salaryData));
    } else {
      alert('Incorrect password. Action cancelled.');
    }
  }

  getAmount(guard: string, monthIdx: number): number | null {
    const year = this.selectedYear.toString();
    const month = (monthIdx + 1).toString().padStart(2, '0');
    return this.salaryData?.[year]?.[guard]?.[month] ?? null;
  }

  async setAmount(guard: string, monthIdx: number, value: string) {
    if (await promptPassword()) {
      const year = this.selectedYear.toString();
      const month = (monthIdx + 1).toString().padStart(2, '0');
      if (!this.salaryData[year]) this.salaryData[year] = {};
      if (!this.salaryData[year][guard]) this.salaryData[year][guard] = {};
      this.salaryData[year][guard][month] = value ? +value : 0;
      this.saveSalaries();
    } else {
      alert('Incorrect password. Action cancelled.');
    }
  }

  years(): number[] {
    const now = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => now - 2 + i);
  }

  getTotal(guard: string): number {
    const year = this.selectedYear.toString();
    if (!this.salaryData[year] || !this.salaryData[year][guard]) return 0;
    return Object.values(this.salaryData[year][guard]).reduce((sum, amt) => sum + (amt || 0), 0);
  }

  async editGuardName(index: number, event: any) {
    if (await promptPassword()) {
      this.guards[index].name = event.target.value;
      this.saveGuards();
    } else {
      alert('Incorrect password. Action cancelled.');
    }
  }

  async addGuard() {
    if (await promptPassword()) {
      this.guards.push({ name: '' });
      this.saveGuards();
    } else {
      alert('Incorrect password. Action cancelled.');
    }
  }

  async removeGuard(index: number) {
    if (await promptPassword()) {
      this.guards.splice(index, 1);
      this.saveGuards();
    } else {
      alert('Incorrect password. Action cancelled.');
    }
  }
}
