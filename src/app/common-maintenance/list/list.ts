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
  items: Array<{ desc: string; cost: number; month: number; year: number }> = [];
  selectedMonth: number = new Date().getMonth();
  selectedYear: number = new Date().getFullYear();
  months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  years: number[] = [];

  constructor(private toast: ToastService) {
    this.loadItems();
    const currentYear = new Date().getFullYear();
    this.years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  }

  loadItems() {
    const data = localStorage.getItem('commonItems');
    this.items = data ? JSON.parse(data) : [];
  }

  get filteredItems() {
    return this.items.filter(
      (item) => item.month === this.selectedMonth && item.year === this.selectedYear
    );
  }

  saveItems() {
    localStorage.setItem('commonItems', JSON.stringify(this.items));
    this.toast.showToast('Saved common maintenance', 5000, 'success');
  }

  addItem() {
    this.items.push({ desc: '', cost: 0, month: this.selectedMonth, year: this.selectedYear });
    this.saveItems();
  }

  removeItem(itemToRemove: { desc: string; cost: number; month: number; year: number }) {
    const index = this.items.indexOf(itemToRemove);
    if (index === -1) {
      return;
    }

    this.items.splice(index, 1);
    this.saveItems();
  }

  updateItem(itemToUpdate: { desc: string; cost: number; month: number; year: number }, field: 'desc' | 'cost', value: string) {
    const index = this.items.indexOf(itemToUpdate);
    if (index === -1) {
      return;
    }

    if (field === 'cost') {
      this.items[index].cost = +value;
    } else {
      this.items[index].desc = value;
    }
    this.saveItems();
  }

  getTotal(): number {
    // Only sum items for the selected month and year
    return this.items.filter(item => item.month === this.selectedMonth && item.year === this.selectedYear)
      .reduce((sum, item) => sum + (item.cost || 0), 0);
  }

  onSelectionChange() {
    this.loadItems();
  }
}
