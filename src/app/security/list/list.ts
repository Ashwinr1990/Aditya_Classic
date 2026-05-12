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
  guards: { name: string }[] = [];
  selectedYear = new Date().getFullYear();
  months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  // Data structure: { [year]: { [guardName]: { [month]: amount } } }
  salaryData: Record<string, Record<string, Record<string, number>>> = {};

  constructor(private toast: ToastService) {
    this.loadGuards();
    this.loadSalaries();
  }

  loadGuards() {
    const data = localStorage.getItem('guards');
    this.guards = data ? JSON.parse(data) : [];
  }

  saveGuards() {
    localStorage.setItem('guards', JSON.stringify(this.guards));
    this.toast.showToast('Saved guards', 5000, 'success');
  }

  loadSalaries() {
    const data = localStorage.getItem('salaryData');
    this.salaryData = data ? JSON.parse(data) : {};
  }

  saveSalaries() {
    localStorage.setItem('salaryData', JSON.stringify(this.salaryData));
    this.toast.showToast('Saved salaries', 5000, 'success');
  }

  getAmount(guard: string, monthIdx: number): number | null {
    const year = this.selectedYear.toString();
    const month = (monthIdx + 1).toString().padStart(2, '0');
    return this.salaryData?.[year]?.[guard]?.[month] ?? null;
  }

  setAmount(guard: string, monthIdx: number, value: string) {
    const year = this.selectedYear.toString();
    const month = (monthIdx + 1).toString().padStart(2, '0');
    if (!this.salaryData[year]) this.salaryData[year] = {};
    if (!this.salaryData[year][guard]) this.salaryData[year][guard] = {};
    this.salaryData[year][guard][month] = value ? +value : 0;
    this.saveSalaries();
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

  editGuardName(index: number, event: any) {
    this.guards[index].name = event.target.value;
    this.saveGuards();
  }

  addGuard() {
    this.guards.push({ name: '' });
    this.saveGuards();
  }

  removeGuard(index: number) {
    this.guards.splice(index, 1);
    this.saveGuards();
  }
}
