// ...existing code...
import { Component, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import Chart from 'chart.js/auto';
import { NgFor, NgIf, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-overview',
  // include Common directives used in template
  imports: [NgFor, NgIf, NgClass, FormsModule],
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
  // Financial summary
  collectedAmount: number = 0; // amount collected under Maintenance
  usedAmount: number = 0; // sum of utilities, security, common maintenance
  totalSavings: number = 0; // collected - used
  // Formatted display strings
  collectedAmountFormatted: string = '0';
  usedAmountFormatted: string = '0';
  totalSavingsFormatted: string = '0';

  private nf = new Intl.NumberFormat('en-IN');
  // animate savings on update
  animateSavings = false;

  // Download financials as a separate Excel file
  downloadFinancials() {
    try {
      const wb = XLSX.utils.book_new();
      const fin = [
        { Metric: 'Collected', Amount: this.collectedAmount },
        { Metric: 'Used', Amount: this.usedAmount },
        { Metric: 'Savings', Amount: this.totalSavings }
      ];
      const ws = XLSX.utils.json_to_sheet(fin);
      XLSX.utils.book_append_sheet(wb, ws, 'Financials');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ACMT-Financials.xlsx';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 0);
      // show global toast
      this.toast.showToast('Financials downloaded', 5000, 'success');
    } catch (e) {
      console.error('Failed to download financials', e);
    }
  }

  constructor(private cdr: ChangeDetectorRef, private toast: ToastService) {}

  exportToExcel() {
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
      // Special flatten for salaryData (security tab)
      else if (key === 'salaryData' && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const salaryRows: any[] = [];
        Object.entries(parsed).forEach(([year, guardsObj]: [string, any]) => {
          Object.entries(guardsObj).forEach(([guard, monthsObj]: [string, any]) => {
            Object.entries(monthsObj).forEach(([month, amount]: [string, any]) => {
              salaryRows.push({ year, guard, month, amount });
            });
          });
        });
        parsed = salaryRows;
      }
      // Special flatten for utilityData
      else if (key === 'utilityData' && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const utilRows: any[] = [];
        Object.entries(parsed).forEach(([year, typesObj]: [string, any]) => {
          Object.entries(typesObj).forEach(([type, monthsObj]: [string, any]) => {
            Object.entries(monthsObj).forEach(([month, amount]: [string, any]) => {
              utilRows.push({ year, type, month, amount });
            });
          });
        });
        parsed = utilRows;
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
    // Append financials sheet
    try {
      const fin = [
        { Metric: 'Collected', Amount: this.collectedAmount },
        { Metric: 'Used', Amount: this.usedAmount },
        { Metric: 'Savings', Amount: this.totalSavings }
      ];
      const fws = XLSX.utils.json_to_sheet(fin);
      XLSX.utils.book_append_sheet(wb, fws, 'Financials');
    } catch (e) {
      // ignore if unable to append
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

  importFromExcel(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
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
          }
          // Special handling for salaryData (security): convert array back to nested object
          else if (sheetName === 'salaryData' && Array.isArray(json)) {
            const nested: any = {};
            json.forEach((row: any) => {
              // accept either 'guard' or 'person' as the column name
              const guardKey = row.guard ?? row.person;
              if (!row.year || !guardKey || !row.month) return;
              if (!nested[row.year]) nested[row.year] = {};
              if (!nested[row.year][guardKey]) nested[row.year][guardKey] = {};
              nested[row.year][guardKey][row.month] = row.amount || 0;
            });
            localStorage.setItem(sheetName, JSON.stringify(nested));
          }
          // Special handling for utilityData: convert array of rows back to nested object
          else if (sheetName === 'utilityData' && Array.isArray(json)) {
            const nested: any = {};
            json.forEach((row: any) => {
              // expect columns: year, type, month, amount
              const typeKey = row.type ?? row.category;
              if (!row.year || !typeKey || !row.month) return;
              if (!nested[row.year]) nested[row.year] = {};
              if (!nested[row.year][typeKey]) nested[row.year][typeKey] = {};
              nested[row.year][typeKey][row.month] = row.amount || 0;
            });
            localStorage.setItem(sheetName, JSON.stringify(nested));
          }
          else if (["utilityData"].includes(sheetName) && json.length > 0 && typeof json[0] === 'object') {
            localStorage.setItem(sheetName, JSON.stringify(json[0]));
          } else {
            localStorage.setItem(sheetName, JSON.stringify(json));
          }
        });
        // Reload dashboard data
        this.loadData();
        this.renderChart();
        this.cdr.detectChanges();
        // show global toast for import success
        this.toast.showToast('Imported data', 5000, 'success');
      } catch (err) {
        console.error('Import failed', err);
        this.toast.showToast('Import failed: invalid file or format', 5000, 'error');
      }
    };
    reader.onerror = (ev) => {
      console.error('File read error', ev);
      this.toast.showToast('Failed to read file', 5000, 'error');
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
      // compute collected/used/savings for the year (showAll)
      this.collectedAmount = this.monthWiseSummary.reduce((s, r) => s + r.maintenance, 0);
      this.usedAmount = this.monthWiseSummary.reduce((s, r) => s + r.utilities + r.security + r.common, 0);
      this.totalSavings = this.collectedAmount - this.usedAmount;
      this.collectedAmountFormatted = this.nf.format(this.collectedAmount);
      this.usedAmountFormatted = this.nf.format(this.usedAmount);
      this.totalSavingsFormatted = this.nf.format(this.totalSavings);
      // trigger savings animation briefly
      this.animateSavings = false;
      setTimeout(() => { this.animateSavings = true; }, 20);
      setTimeout(() => { this.animateSavings = false; }, 800);
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
      // compute collected/used/savings for selected month
      this.collectedAmount = maintThis;
      this.usedAmount = utilThis + secThis + commonThis;
      this.totalSavings = this.collectedAmount - this.usedAmount;
      this.collectedAmountFormatted = this.nf.format(this.collectedAmount);
      this.usedAmountFormatted = this.nf.format(this.usedAmount);
      this.totalSavingsFormatted = this.nf.format(this.totalSavings);
      // trigger savings animation briefly for year view
      this.animateSavings = false;
      setTimeout(() => { this.animateSavings = true; }, 20);
      setTimeout(() => { this.animateSavings = false; }, 800);
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
