import { Component, OnInit } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../services/toast.service';
import { GoogleDriveService } from '../../services/google-drive.service';
import { ExcelExportImportService } from '../../services/excel-export-import.service';

@Component({
  selector: 'app-list',
  imports: [NgFor, NgIf, FormsModule],
  templateUrl: './list.html',
  styleUrl: './list.scss',
})
export class List implements OnInit {
  guards: { name: string }[] = [];
  selectedYear = new Date().getFullYear();
  months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  // Data structure: { [year]: { [guardName]: { [month]: amount } } }
  salaryData: Record<string, Record<string, Record<string, number>>> = {};

  // Google Drive related properties
  googleDriveFileUrl = '';
  fileUrlConfigured = false;
  isLoading = false;

  constructor(
    private toast: ToastService,
    private googleDriveService: GoogleDriveService,
    private excelService: ExcelExportImportService
  ) {
    this.loadGuards();
    this.loadSalaries();
    // Try to load saved URL from localStorage
    const savedUrl = localStorage.getItem('googleDriveFileUrl');
    if (savedUrl) {
      this.googleDriveFileUrl = savedUrl;
      this.fileUrlConfigured = true;
      this.excelService.setFileUrl(savedUrl);
    }
  }

  ngOnInit() {
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

  // Google Drive Methods
  configureFileUrl() {
    try {
      if (!this.googleDriveFileUrl.trim()) {
        this.toast.showToast('Please enter a Google Drive file URL', 5000, 'error');
        return;
      }

      const fileId = this.googleDriveService.extractFileId(this.googleDriveFileUrl);
      if (!fileId) {
        this.toast.showToast('Invalid Google Drive URL format. Expected: https://drive.google.com/file/d/FILE_ID/view', 5000, 'error');
        return;
      }

      this.excelService.setFileUrl(this.googleDriveFileUrl);
      localStorage.setItem('googleDriveFileUrl', this.googleDriveFileUrl);
      this.fileUrlConfigured = true;
      this.toast.showToast('Google Drive file URL configured successfully!', 5000, 'success');
    } catch (error) {
      this.toast.showToast(`Configuration failed: ${error}`, 5000, 'error');
    }
  }

  openGoogleDriveFile() {
    try {
      const fileId = this.googleDriveService.extractFileId(this.googleDriveFileUrl);
      if (!fileId) {
        this.toast.showToast('Invalid file URL', 5000, 'error');
        return;
      }
      const driveLink = `https://drive.google.com/file/d/${fileId}`;
      window.open(driveLink, '_blank');
    } catch (error) {
      this.toast.showToast(`Failed to open file: ${error}`, 5000, 'error');
    }
  }

  copyFileUrl() {
    if (!this.googleDriveFileUrl) return;
    
    navigator.clipboard.writeText(this.googleDriveFileUrl).then(() => {
      this.toast.showToast('File URL copied to clipboard!', 3000, 'success');
    }).catch(() => {
      this.toast.showToast('Failed to copy URL', 3000, 'error');
    });
  }

  clearFileUrl() {
    this.googleDriveFileUrl = '';
    this.fileUrlConfigured = false;
    localStorage.removeItem('googleDriveFileUrl');
    this.toast.showToast('Google Drive URL cleared', 5000, 'info');
  }

  async exportToGoogleDrive() {
    try {
      if (!this.fileUrlConfigured) {
        this.toast.showToast('Please configure Google Drive file URL first', 5000, 'error');
        return;
      }

      this.isLoading = true;
      const result = await this.excelService.autoSaveToGoogleDrive(this.guards, this.salaryData);
      this.toast.showToast('✓ File downloaded! Now upload to Google Drive to sync.', 5000, 'success');
    } catch (error) {
      console.error('Export error:', error);
      this.toast.showToast(`Export failed: ${error}`, 5000, 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async importFromGoogleDrive() {
    try {
      if (!this.fileUrlConfigured) {
        this.toast.showToast('Please configure Google Drive file URL first', 5000, 'error');
        return;
      }

      this.isLoading = true;
      const data = await this.excelService.importFromGoogleDrive();
      this.guards = data.guards;
      this.salaryData = data.salaryData;
      this.saveGuards();
      this.saveSalaries();
      this.toast.showToast('Imported from Google Drive successfully!', 5000, 'success');
    } catch (error) {
      console.error('Import error:', error);
      this.toast.showToast(`Import failed: ${error}`, 5000, 'error');
    } finally {
      this.isLoading = false;
    }
  }

  downloadExcelLocally() {
    try {
      this.excelService.downloadExcelLocally(this.guards, this.salaryData);
      this.toast.showToast('Excel file downloaded successfully!', 5000, 'success');
    } catch (error) {
      console.error('Download error:', error);
      this.toast.showToast(`Download failed: ${error}`, 5000, 'error');
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.importFromFile(file);
  }

  async importFromFile(file: File) {
    try {
      this.isLoading = true;
      const data = await this.excelService.importFromExcel(file);
      this.guards = data.guards;
      this.salaryData = data.salaryData;
      this.saveGuards();
      this.saveSalaries();
      this.toast.showToast('Imported from file successfully!', 5000, 'success');
    } catch (error) {
      console.error('Import error:', error);
      this.toast.showToast(`Import failed: ${error}`, 5000, 'error');
    } finally {
      this.isLoading = false;
    }
  }
}
