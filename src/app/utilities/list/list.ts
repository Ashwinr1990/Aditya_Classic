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
  utilityTypes = ['Electricity', 'Water'];
  months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  selectedYear = new Date().getFullYear();
  utilityData: Record<string, Record<string, Record<string, number>>> = {};

  miscellaneous: { name: string; cost: number; date: string }[] = [];
  newMisc = { name: '', cost: null as any, date: '' };

  constructor() {
    this.loadUtilityData();
    this.loadMiscellaneous();
  }

  years(): number[] {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }

  loadUtilityData() {
    const data = localStorage.getItem('utilityData');
    this.utilityData = data ? JSON.parse(data) : {};
  }

  async saveUtilityData() {
    if (await promptPassword()) {
      localStorage.setItem('utilityData', JSON.stringify(this.utilityData));
    } else {
      alert('Incorrect password. Action cancelled.');
    }
  }

  getAmount(type: string, monthIdx: number): number | null {
    const year = this.selectedYear.toString();
    const month = (monthIdx + 1).toString().padStart(2, '0');
    return this.utilityData?.[year]?.[type]?.[month] ?? null;
  }

  async setAmount(type: string, monthIdx: number, value: string) {
    if (await promptPassword()) {
      const year = this.selectedYear.toString();
      const month = (monthIdx + 1).toString().padStart(2, '0');
      if (!this.utilityData[year]) this.utilityData[year] = {};
      if (!this.utilityData[year][type]) this.utilityData[year][type] = {};
      this.utilityData[year][type][month] = value ? +value : 0;
      this.saveUtilityData();
    } else {
      alert('Incorrect password. Action cancelled.');
    }
  }

  getTotal(type: string): number {
    const year = this.selectedYear.toString();
    if (!this.utilityData[year] || !this.utilityData[year][type]) return 0;
    return Object.values(this.utilityData[year][type]).reduce((a, b) => a + b, 0);
  }

  async addMisc() {
    if (!(await promptPassword())) {
      alert('Incorrect password. Action cancelled.');
      return;
    }
    if (this.newMisc.name.trim() && this.newMisc.cost != null && this.newMisc.date) {
      this.miscellaneous.push({ ...this.newMisc });
      this.saveMiscellaneous();
      this.newMisc = { name: '', cost: null as any, date: '' };
    }
  }

  async saveMiscellaneous() {
    if (await promptPassword()) {
      localStorage.setItem('miscellaneous', JSON.stringify(this.miscellaneous));
    } else {
      alert('Incorrect password. Action cancelled.');
    }
  }

  loadMiscellaneous() {
    const data = localStorage.getItem('miscellaneous');
    this.miscellaneous = data ? JSON.parse(data) : [];
  }
}
