// ...existing code...
import { Component, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import Chart from 'chart.js/auto';
import { NgFor, NgIf, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../services/toast.service';
import { CloudSyncService } from '../../services/cloud-sync.service';
import { AuthService } from '../../services/auth.service';
import { ExcelReportService } from '../../services/excel-report.service';
import { PdfReportService } from '../../services/pdf-report.service';
import { MailRecipient, ReportMailService } from '../../services/report-mail.service';

@Component({
  selector: 'app-overview',
  // include Common directives used in template
  imports: [NgFor, NgIf, NgClass, FormsModule],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
})
export class Overview implements AfterViewInit {
  showAll = true;
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
  utilityAllDetails: Array<{ month: string; type: string; details: string; amount: number }> = [];
  securityAllDetails: Array<{ month: string; guard: string; amount: number }> = [];
  commonAllDetails: Array<{ month: string; item: string; cost: number }> = [];
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

  // Download the styled financial summary for the selected year
  async downloadFinancials() {
    try {
      await this.excelReport.exportFinancials(this.selectedYear);
      this.toast.showToast('Financials downloaded', 5000, 'success');
    } catch (e) {
      console.error('Failed to download financials', e);
      this.toast.showToast('Download failed', 5000, 'error');
    }
  }

  constructor(
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private cloudSync: CloudSyncService,
    private excelReport: ExcelReportService,
    private pdfReport: PdfReportService,
    private reportMail: ReportMailService,
    public auth: AuthService,
  ) {}

  // Clear-all-data dialog
  showClearDialog = false;
  clearPassword = '';
  clearError = '';
  clearing = false;

  openClearDialog() {
    this.clearPassword = '';
    this.clearError = '';
    this.showClearDialog = true;
  }

  closeClearDialog() {
    if (this.clearing) return;
    this.showClearDialog = false;
  }

  async confirmClearAll() {
    if (!this.clearPassword || this.clearing) return;
    const sure = window.confirm(
      'Are you sure you want to delete ALL data and backups for everyone?\n\nThis cannot be undone.\n\nOK = Yes, delete everything\nCancel = No, keep my data'
    );
    if (!sure) {
      this.showClearDialog = false;
      this.toast.showToast('Clear cancelled; no data was deleted', 4000, 'info');
      return;
    }
    this.clearing = true;
    this.clearError = '';
    this.cdr.detectChanges();
    try {
      await this.cloudSync.clearAllData(this.clearPassword);
      // Reload so every page starts from empty data, like a new user.
      window.location.href = '/';
    } catch (e: any) {
      this.clearError = e?.message ?? 'Delete failed.';
      this.clearing = false;
      this.cdr.detectChanges();
    }
  }

  // Email the PDF report to selected people
  showMailDialog = false;
  mailRecipients: MailRecipient[] = [];
  mailWithoutEmail = 0;
  mailSelected = new Set<string>();
  mailMessage = '';
  mailError = '';
  sendingMail = false;

  openMailDialog() {
    const { list, withoutEmail } = this.reportMail.recipients();
    this.mailRecipients = list;
    this.mailWithoutEmail = withoutEmail;
    this.mailSelected = new Set();
    this.mailMessage = '';
    this.mailError = '';
    this.showMailDialog = true;
  }

  closeMailDialog() {
    if (this.sendingMail) return;
    this.showMailDialog = false;
  }

  toggleMail(email: string) {
    if (this.mailSelected.has(email)) this.mailSelected.delete(email);
    else this.mailSelected.add(email);
  }

  allMailSelected(): boolean {
    return this.mailRecipients.length > 0 && this.mailSelected.size === this.mailRecipients.length;
  }

  toggleAllMail(checked: boolean) {
    this.mailSelected = new Set(checked ? this.mailRecipients.map(r => r.email) : []);
  }

  async sendMail() {
    if (this.sendingMail || this.mailSelected.size === 0) return;
    this.sendingMail = true;
    this.mailError = '';
    this.cdr.detectChanges();
    try {
      const { sent } = await this.reportMail.send(this.selectedYear, [...this.mailSelected], this.mailMessage);
      this.showMailDialog = false;
      this.toast.showToast(`Report emailed to ${sent} ${sent === 1 ? 'person' : 'people'}`, 5000, 'success');
    } catch (e: any) {
      this.mailError = e?.message ?? 'Sending failed.';
    } finally {
      this.sendingMail = false;
      this.cdr.detectChanges();
    }
  }

  // Printable PDF report for the selected year
  exportingPdf = false;
  async exportToPdf() {
    if (this.exportingPdf) return;
    this.exportingPdf = true;
    this.cdr.detectChanges();
    try {
      await this.pdfReport.exportYear(this.selectedYear);
      this.toast.showToast('PDF downloaded', 5000, 'success');
    } catch (e) {
      console.error('PDF export failed', e);
      this.toast.showToast('PDF export failed', 5000, 'error');
    } finally {
      this.exportingPdf = false;
      this.cdr.detectChanges();
    }
  }

  // Styled workbook: report sheets for the selected year plus all data sheets (re-importable)
  async exportToExcel() {
    try {
      await this.excelReport.exportAll(this.selectedYear);
      this.toast.showToast('Excel exported', 5000, 'success');
    } catch (e) {
      console.error('Export failed', e);
      this.toast.showToast('Export failed', 5000, 'error');
    }
  }

  importFromExcel(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        // Writes each data sheet into localStorage; auto-save then uploads it to the cloud
        this.cloudSync.applyWorkbook(e.target.result);
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
    this.utilityAllDetails = [];
    this.securityAllDetails = [];
    this.commonAllDetails = [];
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
          Object.keys(utilityData[year]).forEach((type: string) => {
            const monthValues = utilityData[year][type] || {};
            if (Object.prototype.hasOwnProperty.call(monthValues, monthStr)) {
              const amount = monthValues[monthStr] || 0;
              util += amount;
              this.utilityAllDetails.push({
                month: this.months[m],
                type,
                details: '-',
                amount,
              });
            }
          });
        }
        // Miscellaneous
        let misc = 0;
        if (Array.isArray(miscItems)) {
          const miscForMonth = miscItems.filter((item: any) => {
            if (!item.date) return false;
            const d = new Date(item.date);
            return d.getMonth() === m && d.getFullYear() === year;
          });

          misc = miscForMonth.reduce((sum: number, item: any) => sum + (item.cost || 0), 0);
          miscForMonth.forEach((item: any) => {
            this.utilityAllDetails.push({
              month: this.months[m],
              type: 'Miscellaneous',
              details: item.name || '-',
              amount: item.cost || 0,
            });
          });
        }
        util += misc;
        // Security
        let sec = 0;
        if (salaryData[year]) {
          for (const guard in salaryData[year]) {
            const guardMonths = salaryData[year][guard] || {};
            if (Object.prototype.hasOwnProperty.call(guardMonths, monthStr)) {
              const amount = guardMonths[monthStr] || 0;
              sec += amount;
              this.securityAllDetails.push({
                month: this.months[m],
                guard,
                amount,
              });
            }
          }
        }
        // Common Maintenance
        let common = 0;
        if (Array.isArray(commonItems)) {
          const commonForMonth = commonItems.filter(
            (item: any) => Number(item.month) === m && Number(item.year) === year
          );

          common = commonForMonth.reduce((sum: number, item: any) => sum + (item.cost || 0), 0);
          commonForMonth.forEach((item: any) => {
            this.commonAllDetails.push({
              month: this.months[m],
              item: item.desc || '-',
              cost: item.cost || 0,
            });
          });
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
      ['Electricity', 'Water', 'BBMP'].forEach(type => {
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
        commonThis = commonItems.filter(item => Number(item.month) === thisMonthIdx && Number(item.year) === year)
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
