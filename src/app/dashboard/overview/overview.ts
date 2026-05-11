// ...existing code...
import { Component, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { promptPassword } from '../../password-util';
import Chart from 'chart.js/auto';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-overview',
  imports: [NgFor, NgIf, FormsModule],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
})
export class Overview implements AfterViewInit {
  showAll = false;
  toggleShowAll() {
    this.showAll = !this.showAll;
    this.loadData();
    this.renderChart();
  }
  maintThisDetails: any[] = [];
  private chartInstance: Chart|null = null;
  months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  years: number[] = [];
  selectedMonth: number = 0;
  selectedYear: number = 0;
  summary = [
    { category: 'Maintenance', thisMonth: 0, lastMonth: 0 },
    { category: 'Utilities', thisMonth: 0, lastMonth: 0 },
    { category: 'Security', thisMonth: 0, lastMonth: 0 },
    { category: 'Common Maintenance', thisMonth: 0, lastMonth: 0 },
  ];
  monthWiseSummary: { month: string, maintenance: number, utilities: number, security: number, common: number }[] = [];

  constructor(private cdr: ChangeDetectorRef) {}

  async exportToExcel() {
    if (!(await promptPassword())) {
      alert('Incorrect password. Export cancelled.');
      return;
    }
    // Export ALL localStorage keys and values
    const wb = XLSX.utils.book_new();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      let value = localStorage.getItem(key);
      let parsed;
      try {
        parsed = JSON.parse(value || 'null');
      } catch {
        parsed = value;
      }
      // Special flatten for maintenanceData
      if (key === 'maintenanceData' && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const maintenanceRows: any[] = [];
        Object.entries(parsed).forEach(([year, peopleObj]: [string, any]) => {
          Object.entries(peopleObj).forEach(([person, monthsObj]: [string, any]) => {
            Object.entries(monthsObj).forEach(([month, amount]: [string, any]) => {
              maintenanceRows.push({ year, person, month, amount });
            });
          });
        });
        parsed = maintenanceRows;
      }
      let ws;
      if (Array.isArray(parsed)) {
        ws = XLSX.utils.json_to_sheet(parsed);
      } else if (typeof parsed === 'object' && parsed !== null) {
        ws = XLSX.utils.json_to_sheet([parsed]);
      } else {
        ws = XLSX.utils.aoa_to_sheet([[parsed]]);
      }
      XLSX.utils.book_append_sheet(wb, ws, key);
    }
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    // Native browser download (no file-saver)
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ACMT-Data.xlsx';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 0);
  }

  async importFromExcel(event: any) {
    if (!(await promptPassword())) {
      alert('Incorrect password. Import cancelled.');
      return;
    }
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      let summary = 'Imported Sheets and Row Counts:\n';
      // For each sheet, update localStorage
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: null });
        summary += `- ${sheetName}: ${json.length} rows\n`;
        // Special handling for maintenanceData: convert array to nested object
        if (sheetName === 'maintenanceData' && Array.isArray(json)) {
          const nested: any = {};
          json.forEach((row: any) => {
            if (!row.year || !row.person || !row.month) return;
            if (!nested[row.year]) nested[row.year] = {};
            if (!nested[row.year][row.person]) nested[row.year][row.person] = {};
            nested[row.year][row.person][row.month] = row.amount || 0;
          });
          localStorage.setItem(sheetName, JSON.stringify(nested));
        } else if (["utilityData","salaryData"].includes(sheetName) && json.length > 0 && typeof json[0] === 'object') {
          localStorage.setItem(sheetName, JSON.stringify(json[0]));
        } else {
          localStorage.setItem(sheetName, JSON.stringify(json));
        }
      });
      // Reload dashboard data
      this.loadData();
      this.renderChart();
      this.cdr.detectChanges();
      // alert removed: Data imported from Excel!\n' + summary
    };
    reader.readAsArrayBuffer(file);
  }

// ...existing code...
  private storageListener = (event: StorageEvent) => {
    if (["maintenanceData", "utilityData", "salaryData", "commonItems"].includes(event.key || "")) {
      this.loadData();
      this.renderChart();
    }
  };
  ngAfterViewInit() {
    const now = new Date();
    this.selectedMonth = now.getMonth();
    const currentYear = now.getFullYear();
    this.years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
    this.selectedYear = currentYear;
    this.loadData();
    this.renderChart();
    window.addEventListener('storage', this.storageListener);
  }
  refreshDashboard() {
    this.loadData();
    this.renderChart();
  }
  onSelectionChange() {
    this.selectedMonth = Number(this.selectedMonth);
    this.selectedYear = Number(this.selectedYear);
    this.loadData();
    this.renderChart();
  }
  loadData() {
    const thisMonthIdx = this.selectedMonth;
    const lastMonthIdx = (thisMonthIdx + 11) % 12;
    const year = this.selectedYear;
    const lastMonthYear = thisMonthIdx === 0 ? year - 1 : year;
    // Maintenance
    const maintenanceData = JSON.parse(localStorage.getItem('maintenanceData') || '{}');
    const utilityData = JSON.parse(localStorage.getItem('utilityData') || '{}');
    const salaryData = JSON.parse(localStorage.getItem('salaryData') || '{}');
    const commonItems = JSON.parse(localStorage.getItem('commonItems') || '[]');
    const miscItems = JSON.parse(localStorage.getItem('miscellaneous') || '[]');
    let maintThis = 0, maintLast = 0;
    this.maintThisDetails = [];
    if (this.showAll) {
      // Month-wise summary for the selected year
      this.monthWiseSummary = [];
      for (let m = 0; m < 12; m++) {
        const monthStr = (m + 1).toString().padStart(2, '0');
        // Maintenance
        let maint = 0;
        if (maintenanceData[year]) {
          for (const person in maintenanceData[year]) {
            maint += maintenanceData[year][person][monthStr] || 0;
          }
        }
        // Utilities
        let util = 0;
        if (utilityData[year]) {
          ['Electricity', 'Water'].forEach((type: string) => {
            if (utilityData[year][type]) {
              util += utilityData[year][type][monthStr] || 0;
            }
          });
        }
        // Miscellaneous
        let misc = 0;
        if (Array.isArray(miscItems)) {
          misc = miscItems.filter((item: any) => {
            if (!item.date) return false;
            const d = new Date(item.date);
            return d.getMonth() === m && d.getFullYear() === year;
          }).reduce((sum: number, item: any) => sum + (item.cost || 0), 0);
        }
        util += misc;
        // Security
        let sec = 0;
        if (salaryData[year]) {
          for (const guard in salaryData[year]) {
            sec += salaryData[year][guard][monthStr] || 0;
          }
        }
        // Common Maintenance
        let common = 0;
        if (Array.isArray(commonItems)) {
          common = commonItems.filter((item: any) => item.month === m && item.year === year)
            .reduce((sum: number, item: any) => sum + (item.cost || 0), 0);
        }
        this.monthWiseSummary.push({
          month: this.months[m],
          maintenance: maint,
          utilities: util,
          security: sec,
          common: common
        });
      }
      // Also sum for the summary
      this.summary[0].thisMonth = this.monthWiseSummary.reduce((sum: number, row) => sum + row.maintenance, 0);
      this.summary[1].thisMonth = this.monthWiseSummary.reduce((sum: number, row) => sum + row.utilities, 0);
      this.summary[2].thisMonth = this.monthWiseSummary.reduce((sum: number, row) => sum + row.security, 0);
      this.summary[3].thisMonth = this.monthWiseSummary.reduce((sum: number, row) => sum + row.common, 0);
    } else {
      this.monthWiseSummary = [];
      const monthStr = (thisMonthIdx + 1).toString().padStart(2, '0');
      if (maintenanceData[year]) {
        for (const person in maintenanceData[year]) {
          const m = maintenanceData[year][person];
          const val = m[monthStr] || 0;
          maintThis += val;
          this.maintThisDetails.push({ person, month: monthStr, value: val });
        }
      }
      this.summary[0].thisMonth = maintThis;
      // Utilities
      let utilThis = 0;
      ['Electricity', 'Water'].forEach(type => {
        if (utilityData[year] && utilityData[year][type]) {
          utilThis += utilityData[year][type][monthStr] || 0;
        }
      });
      // Miscellaneous
      let miscThis = 0;
      if (Array.isArray(miscItems)) {
        miscThis = miscItems.filter(item => {
          if (!item.date) return false;
          const d = new Date(item.date);
          return d.getMonth() === thisMonthIdx && d.getFullYear() === year;
        }).reduce((sum, item) => sum + (item.cost || 0), 0);
      }
      utilThis += miscThis;
      this.summary[1].thisMonth = utilThis;
      // Security
      let secThis = 0;
      if (salaryData[year]) {
        for (const guard in salaryData[year]) {
          secThis += salaryData[year][guard][monthStr] || 0;
        }
      }
      this.summary[2].thisMonth = secThis;
      // Common Maintenance
      let commonThis = 0;
      if (Array.isArray(commonItems)) {
        commonThis = commonItems.filter(item => item.month === thisMonthIdx && item.year === year)
          .reduce((sum, item) => sum + (item.cost || 0), 0);
      }
      this.summary[3].thisMonth = commonThis;
    }
    this.cdr.detectChanges();
  }
  renderChart() {
    const ctx = document.getElementById('expenseChart') as HTMLCanvasElement;
    if (ctx) {
      // Destroy previous chart instance if it exists
      if (this.chartInstance) {
        this.chartInstance.destroy();
      }
      if (this.showAll) {
        // Multi-series bar chart: months on X, categories as series
        this.chartInstance = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: this.months,
            datasets: [
              {
                label: 'Maintenance',
                data: this.monthWiseSummary.map(row => row.maintenance),
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
              },
              {
                label: 'Utilities',
                data: this.monthWiseSummary.map(row => row.utilities),
                backgroundColor: 'rgba(255, 206, 86, 0.6)',
                borderColor: 'rgba(255, 206, 86, 1)',
                borderWidth: 1
              },
              {
                label: 'Security',
                data: this.monthWiseSummary.map(row => row.security),
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1
              },
              {
                label: 'Common Maintenance',
                data: this.monthWiseSummary.map(row => row.common),
                backgroundColor: 'rgba(153, 102, 255, 0.6)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1
              }
            ]
          },
          options: {
            responsive: true,
            plugins: {
              legend: {
                display: true
              },
              title: {
                display: true,
                text: `Month-wise Expenses for ${this.selectedYear}`
              }
            },
            scales: {
              y: {
                beginAtZero: true
              }
            }
          }
        });
      } else {
        // Single-bar chart: categories on X, thisMonth as data
        this.chartInstance = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: this.summary.map(s => s.category),
            datasets: [
              {
                label: `This Month`,
                data: this.summary.map(s => s.thisMonth),
                backgroundColor: [
                  'rgba(75, 192, 192, 0.2)',
                  'rgba(255, 206, 86, 0.2)',
                  'rgba(255, 99, 132, 0.2)',
                  'rgba(153, 102, 255, 0.2)'
                ],
                borderColor: [
                  'rgba(75, 192, 192, 1)',
                  'rgba(255, 206, 86, 1)',
                  'rgba(255, 99, 132, 1)',
                  'rgba(153, 102, 255, 1)'
                ],
                borderWidth: 1
              }
            ]
          },
          options: {
            responsive: true,
            plugins: {
              legend: {
                display: false
              },
              title: {
                display: true,
                text: `Expenses for ${this.months[this.selectedMonth]} ${this.selectedYear}`
              }
            },
            scales: {
              y: {
                beginAtZero: true
              }
            }
          }
        });
      }
    }

  }
}
