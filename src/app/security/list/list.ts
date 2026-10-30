import { Component, OnInit } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../i18n/language.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { PersonNamePipe } from '../../i18n/person-name.pipe';
import { GoogleDriveService } from '../../services/google-drive.service';
import { ExcelExportImportService } from '../../services/excel-export-import.service';

@Component({
  selector: 'app-list',
  imports: [NgFor, NgIf, FormsModule, TranslatePipe, PersonNamePipe],
  templateUrl: './list.html',
  styleUrl: './list.scss',
})
export class List implements OnInit {
  // nameKn: the name as written in Kannada, when the automatic spelling is wrong
  guards: { name: string; nameKn?: string }[] = [];
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
    public auth: AuthService,
    private toast: ToastService,
    private googleDriveService: GoogleDriveService,
    private excelService: ExcelExportImportService,
    private i18n: LanguageService,
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
    this.toast.showToast(this.i18n.t('Saved guards'), 5000, 'success');
  }

  loadSalaries() {
    const data = localStorage.getItem('salaryData');
    this.salaryData = data ? JSON.parse(data) : {};
  }

  saveSalaries() {
    localStorage.setItem('salaryData', JSON.stringify(this.salaryData));
    this.toast.showToast(this.i18n.t('Saved salaries'), 5000, 'success');
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

  // In Kannada mode the box shows the Kannada name, so a change there corrects the Kannada spelling.
  // A guard without an English name yet takes what is typed as their name.
  nameChanged(index: number, input: HTMLInputElement) {
    if (this.i18n.lang() === 'kn' && /[A-Za-z]/.test(this.guards[index].name ?? '')) this.setKannadaName(index, input);
    else this.renameGuard(index, input);
  }

  // Salaries are stored by guard name, so a rename moves them to the new name.
  renameGuard(index: number, input: HTMLInputElement) {
    const oldName = this.guards[index].name ?? '';
    const newName = input.value.trim();
    if (newName === oldName) return;
    if (newName && this.guards.some((g, i) => i !== index && g.name === newName)) {
      this.toast.showToast(this.i18n.t('A guard named "{name}" already exists', { name: newName }), 5000, 'error');
      input.value = oldName;
      return;
    }
    // Another guard with the old name (e.g. two blank rows) keeps its copy of the salaries.
    const shared = this.guards.some((g, i) => i !== index && (g.name ?? '') === oldName);
    for (const year of Object.keys(this.salaryData)) {
      const months = this.salaryData[year][oldName];
      if (!months) continue;
      this.salaryData[year][newName] = shared ? { ...months } : months;
      if (!shared) delete this.salaryData[year][oldName];
    }
    this.guards[index].name = newName;
    // A Kannada spelling saved for the old name doesn't fit the new one
    delete this.guards[index].nameKn;
    this.saveGuards();
    this.saveSalaries();
  }

  // Empty goes back to the automatic spelling.
  private setKannadaName(index: number, input: HTMLInputElement) {
    const guard = this.guards[index];
    const nameKn = input.value.trim();
    if (nameKn) guard.nameKn = nameKn;
    else delete guard.nameKn;
    input.value = this.i18n.name(guard.name, guard.nameKn);
    this.saveGuards();
  }

  addGuard() {
    this.guards.push({ name: '' });
    this.saveGuards();
  }

  removeGuard(index: number) {
    const name = this.guards[index].name ?? '';
    const ok = window.confirm(
      (name ? this.i18n.t('Remove {name}?', { name }) : this.i18n.t('Remove this guard?')) + '\n\n' +
        this.i18n.t('Their salary for all years will also be deleted. This cannot be undone.')
    );
    if (!ok) return;
    this.guards.splice(index, 1);
    if (!this.guards.some(g => (g.name ?? '') === name)) {
      for (const year of Object.keys(this.salaryData)) delete this.salaryData[year][name];
      this.saveSalaries();
    }
    this.saveGuards();
  }

  // Google Drive Methods
  configureFileUrl() {
    try {
      if (!this.googleDriveFileUrl.trim()) {
        this.toast.showToast(this.i18n.t('Please enter a Google Drive file URL'), 5000, 'error');
        return;
      }

      const fileId = this.googleDriveService.extractFileId(this.googleDriveFileUrl);
      if (!fileId) {
        this.toast.showToast(this.i18n.t('Invalid Google Drive URL format. Expected: https://drive.google.com/file/d/FILE_ID/view'), 5000, 'error');
        return;
      }

      this.excelService.setFileUrl(this.googleDriveFileUrl);
      localStorage.setItem('googleDriveFileUrl', this.googleDriveFileUrl);
      this.fileUrlConfigured = true;
      this.toast.showToast(this.i18n.t('Google Drive file URL configured successfully!'), 5000, 'success');
    } catch (error) {
      this.toast.showToast(this.i18n.t('Configuration failed: {error}', { error }), 5000, 'error');
    }
  }

  openGoogleDriveFile() {
    try {
      const fileId = this.googleDriveService.extractFileId(this.googleDriveFileUrl);
      if (!fileId) {
        this.toast.showToast(this.i18n.t('Invalid file URL'), 5000, 'error');
        return;
      }
      const driveLink = `https://drive.google.com/file/d/${fileId}`;
      window.open(driveLink, '_blank');
    } catch (error) {
      this.toast.showToast(this.i18n.t('Failed to open file: {error}', { error }), 5000, 'error');
    }
  }

  copyFileUrl() {
    if (!this.googleDriveFileUrl) return;
    
    navigator.clipboard.writeText(this.googleDriveFileUrl).then(() => {
      this.toast.showToast(this.i18n.t('File URL copied to clipboard!'), 3000, 'success');
    }).catch(() => {
      this.toast.showToast(this.i18n.t('Failed to copy URL'), 3000, 'error');
    });
  }

  clearFileUrl() {
    this.googleDriveFileUrl = '';
    this.fileUrlConfigured = false;
    localStorage.removeItem('googleDriveFileUrl');
    this.toast.showToast(this.i18n.t('Google Drive URL cleared'), 5000, 'info');
  }

  async exportToGoogleDrive() {
    try {
      if (!this.fileUrlConfigured) {
        this.toast.showToast(this.i18n.t('Please configure Google Drive file URL first'), 5000, 'error');
        return;
      }

      this.isLoading = true;
      const result = await this.excelService.autoSaveToGoogleDrive(this.guards, this.salaryData);
      this.toast.showToast(this.i18n.t('✓ File downloaded! Now upload to Google Drive to sync.'), 5000, 'success');
    } catch (error) {
      console.error('Export error:', error);
      this.toast.showToast(this.i18n.t('Export failed: {error}', { error }), 5000, 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async importFromGoogleDrive() {
    try {
      if (!this.fileUrlConfigured) {
        this.toast.showToast(this.i18n.t('Please configure Google Drive file URL first'), 5000, 'error');
        return;
      }

      this.isLoading = true;
      const data = await this.excelService.importFromGoogleDrive();
      this.guards = data.guards;
      this.salaryData = data.salaryData;
      this.saveGuards();
      this.saveSalaries();
      this.toast.showToast(this.i18n.t('Imported from Google Drive successfully!'), 5000, 'success');
    } catch (error) {
      console.error('Import error:', error);
      this.toast.showToast(this.i18n.t('Import failed: {error}', { error }), 5000, 'error');
    } finally {
      this.isLoading = false;
    }
  }

  downloadExcelLocally() {
    try {
      this.excelService.downloadExcelLocally(this.guards, this.salaryData);
      this.toast.showToast(this.i18n.t('Excel file downloaded successfully!'), 5000, 'success');
    } catch (error) {
      console.error('Download error:', error);
      this.toast.showToast(this.i18n.t('Download failed: {error}', { error }), 5000, 'error');
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
      this.toast.showToast(this.i18n.t('Imported from file successfully!'), 5000, 'success');
    } catch (error) {
      console.error('Import error:', error);
      this.toast.showToast(this.i18n.t('Import failed: {error}', { error }), 5000, 'error');
    } finally {
      this.isLoading = false;
    }
  }
}
