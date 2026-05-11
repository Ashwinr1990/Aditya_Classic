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
  items: Array<{ desc: string; cost: number; month: number; year: number }> = [];
  selectedMonth: number = new Date().getMonth();
  selectedYear: number = new Date().getFullYear();
  months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  years: number[] = [];

  constructor() {
    this.loadItems();
    const currentYear = new Date().getFullYear();
    this.years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  }

  loadItems() {
    const data = localStorage.getItem('commonItems');
    this.items = data ? JSON.parse(data) : [];
  }

  async saveItems() {
    if (await promptPassword()) {
      localStorage.setItem('commonItems', JSON.stringify(this.items));
    } else {
      alert('Incorrect password. Action cancelled.');
    }
  }

  async addItem() {
    if (await promptPassword()) {
      this.items.push({ desc: '', cost: 0, month: this.selectedMonth, year: this.selectedYear });
      this.saveItems();
    } else {
      alert('Incorrect password. Action cancelled.');
    }
  }

  async removeItem(index: number) {
    if (await promptPassword()) {
      this.items.splice(index, 1);
      this.saveItems();
    } else {
      alert('Incorrect password. Action cancelled.');
    }
  }

  async updateItem(index: number, field: 'desc' | 'cost', value: string) {
    if (await promptPassword()) {
      if (field === 'cost') {
        this.items[index].cost = +value;
      } else {
        this.items[index].desc = value;
      }
      this.saveItems();
    } else {
      alert('Incorrect password. Action cancelled.');
    }
  }

  getTotal(): number {
    // Only sum items for the selected month and year
    return this.items.filter(item => item.month === this.selectedMonth && item.year === this.selectedYear)
      .reduce((sum, item) => sum + (item.cost || 0), 0);
  }

  onSelectionChange() {
    // Just trigger Angular change detection and save selection if needed
  }
}
