import { Component } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../i18n/language.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { UserTextPipe } from '../../i18n/user-text.pipe';

// descKn: the item's Kannada text, when the automatic translation is wrong
type Item = { desc: string; descKn?: string; cost: number; month: number; year: number };

@Component({
  selector: 'app-list',
  imports: [NgFor, NgIf, FormsModule, TranslatePipe, UserTextPipe],
  templateUrl: './list.html',
  styleUrl: './list.scss',
})
export class List {
  items: Item[] = [];
  selectedMonth: number = new Date().getMonth();
  selectedYear: number = new Date().getFullYear();
  months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  years: number[] = [];

  constructor(public auth: AuthService, private toast: ToastService, public i18n: LanguageService) {
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
    this.toast.showToast(this.i18n.t('Saved common maintenance'), 5000, 'success');
  }

  addItem() {
    this.items.push({ desc: '', cost: 0, month: this.selectedMonth, year: this.selectedYear });
    this.saveItems();
  }

  removeItem(itemToRemove: Item) {
    const index = this.items.indexOf(itemToRemove);
    if (index === -1) {
      return;
    }

    this.items.splice(index, 1);
    this.saveItems();
  }

  updateItem(itemToUpdate: Item, field: 'desc' | 'cost', value: string) {
    const index = this.items.indexOf(itemToUpdate);
    if (index === -1) {
      return;
    }

    if (field === 'cost') {
      this.items[index].cost = +value;
    } else {
      this.items[index].desc = value;
      // A Kannada correction of the old text doesn't fit the new one
      delete this.items[index].descKn;
    }
    this.saveItems();
  }

  // English mode: the box holds the item's text and saves as it is typed.
  descInput(item: Item, value: string) {
    if (this.i18n.lang() === 'en') this.updateItem(item, 'desc', value);
  }

  // Kannada mode: the box shows the Kannada, so a change there corrects the Kannada (empty = automatic again).
  // An item without English text yet takes what is typed as its text.
  descChanged(item: Item, input: HTMLInputElement) {
    if (this.i18n.lang() !== 'kn') return;
    if (!/[A-Za-z]/.test(item.desc ?? '')) {
      this.updateItem(item, 'desc', input.value);
      return;
    }
    const descKn = input.value.trim();
    if (descKn) item.descKn = descKn;
    else delete item.descKn;
    input.value = this.i18n.text(item.desc, item.descKn);
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
