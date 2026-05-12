// Removed stray top-level getTotal definition
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
  selectedYear = new Date().getFullYear();
  months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  // Data structure: { [year]: { [personName]: { [month]: amount } } }
  maintenanceData: Record<string, Record<string, Record<string, number>>> = {};

  constructor(private toast: ToastService) {
    this.loadPeople();
    this.loadMaintenance();
  }

  loadPeople() {
    const data = localStorage.getItem('people');
    this.people = data ? JSON.parse(data) : [];
  }

  loadMaintenance() {
    const data = localStorage.getItem('maintenanceData');
    this.maintenanceData = data ? JSON.parse(data) : {};
  }

  saveMaintenance() {
    localStorage.setItem('maintenanceData', JSON.stringify(this.maintenanceData));
    this.toast.showToast('Saved maintenance', 5000, 'success');
  }

  getAmount(person: string, monthIdx: number): number | null {
    const year = this.selectedYear.toString();
    const month = (monthIdx + 1).toString().padStart(2, '0');
    return this.maintenanceData?.[year]?.[person]?.[month] ?? null;
  }

  setAmount(person: string, monthIdx: number, value: string) {
    const year = this.selectedYear.toString();
    const month = (monthIdx + 1).toString().padStart(2, '0');
    if (!this.maintenanceData[year]) this.maintenanceData[year] = {};
    if (!this.maintenanceData[year][person]) this.maintenanceData[year][person] = {};
    this.maintenanceData[year][person][month] = value ? +value : 0;
    this.saveMaintenance();
  }

  getFullDate(monthIdx: number): string {
    return `${this.selectedYear}-${(monthIdx + 1).toString().padStart(2, '0')}-01`;
  }

  years(): number[] {
    const now = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => now - 2 + i); // 2 years back, 3 ahead
  }

  getTotal(person: string): number {
    const year = this.selectedYear.toString();
    if (!this.maintenanceData[year] || !this.maintenanceData[year][person]) return 0;
    return Object.values(this.maintenanceData[year][person]).reduce((sum, amt) => sum + (amt || 0), 0);
  }
}
