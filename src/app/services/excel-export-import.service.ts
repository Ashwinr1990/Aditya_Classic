import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { GoogleDriveService } from './google-drive.service';

@Injectable({ providedIn: 'root' })
export class ExcelExportImportService {
  private readonly EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  private readonly DEFAULT_FILE_NAME = 'ACMT.xlsx';
  private fileUrl: string = '';

  constructor(private googleDriveService: GoogleDriveService) {}

  /**
   * Set Google Drive file URL for import/export
   * URL format: https://drive.google.com/file/d/FILE_ID/view
   */
  setFileUrl(url: string) {
    if (!url) {
      throw new Error('Please provide a valid Google Drive file URL');
    }
    this.fileUrl = url;
  }

  getFileUrl(): string {
    return this.fileUrl;
  }

  /**
   * Export guards and salary data to Excel file
   */
  exportToExcel(
    guards: { name: string }[],
    salaryData: Record<string, Record<string, Record<string, number>>>,
    fileName: string = this.DEFAULT_FILE_NAME
  ): Blob {
    const workbook = XLSX.utils.book_new();

    // Create Guards sheet
    const guardsData = guards.map((guard) => ({ 'Guard Name': guard.name }));
    const guardsSheet = XLSX.utils.json_to_sheet(guardsData);
    guardsSheet['!cols'] = [{ wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, guardsSheet, 'Guards');

    // Create Salary Data sheet with proper formatting
    const salaryRows = this.formatSalaryDataForExcel(salaryData, guards);
    const salarySheet = XLSX.utils.json_to_sheet(salaryRows);
    salarySheet['!cols'] = [
      { wch: 20 }, // Guard Name
      ...Array(12).fill({ wch: 12 }), // Months
      { wch: 15 }, // Total
    ];
    XLSX.utils.book_append_sheet(workbook, salarySheet, 'Salary Data');

    // Create Summary sheet
    const summaryData = this.createSalaryChangeSummary(salaryData, guards);
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 20 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], { type: this.EXCEL_MIME_TYPE });
  }

  /**
   * Import guards and salary data from Excel file
   */
  async importFromExcel(file: File): Promise<{ guards: { name: string }[]; salaryData: Record<string, Record<string, Record<string, number>>> }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event: any) => {
        try {
          const data = event.target.result;
          const workbook = XLSX.read(data, { type: 'array' });

          // Read Guards sheet
          const guardsSheet = workbook.Sheets['Guards'];
          const guardsData = XLSX.utils.sheet_to_json(guardsSheet) as any[];
          const guards = guardsData.map((row) => ({
            name: row['Guard Name'] || '',
          }));

          // Read Salary Data sheet
          const salarySheet = workbook.Sheets['Salary Data'];
          const salaryRows = XLSX.utils.sheet_to_json(salarySheet) as any[];
          const salaryData = this.parseSalaryDataFromExcel(salaryRows);

          resolve({ guards, salaryData });
        } catch (error) {
          reject(new Error(`Failed to import Excel file: ${error}`));
        }
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Auto-save to Google Drive (saves locally and provides download)
   * User needs to manually upload to replace the file in Drive
   */
  async autoSaveToGoogleDrive(
    guards: { name: string }[],
    salaryData: Record<string, Record<string, Record<string, number>>>
  ): Promise<any> {
    try {
      if (!this.fileUrl) {
        throw new Error('Please set Google Drive file URL first using setFileUrl()');
      }

      const fileId = this.googleDriveService.extractFileId(this.fileUrl);
      if (!fileId) {
        throw new Error('Invalid Google Drive URL format');
      }

      // Create the Excel file
      const excelBlob = this.exportToExcel(guards, salaryData, this.DEFAULT_FILE_NAME);
      
      // Save to Drive via browser download (user will manually upload)
      const url = URL.createObjectURL(excelBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = this.DEFAULT_FILE_NAME;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return {
        success: true,
        message: 'File downloaded. Please upload it to Google Drive to update.',
        fileId: fileId,
        driveLink: `https://drive.google.com/file/d/${fileId}`,
        instructions: 'Download → Go to Google Drive link → Right-click file → Replace version'
      };
    } catch (error) {
      throw new Error(`Failed to save to Google Drive: ${error}`);
    }
  }

  /**
   * Import from Google Drive using file URL
   */
  async importFromGoogleDrive(): Promise<{ guards: { name: string }[]; salaryData: Record<string, Record<string, Record<string, number>>> }> {
    try {
      if (!this.fileUrl) {
        throw new Error('Please set Google Drive file URL first using setFileUrl()');
      }

      const fileId = this.googleDriveService.extractFileId(this.fileUrl);
      if (!fileId) {
        throw new Error('Invalid Google Drive URL format');
      }

      const arrayBuffer = await this.googleDriveService.downloadFile(fileId);
      const file = new File([arrayBuffer], 'import.xlsx', { type: this.EXCEL_MIME_TYPE });
      return await this.importFromExcel(file);
    } catch (error) {
      throw new Error(`Failed to import from Google Drive: ${error}`);
    }
  }

  /**
   * Download Excel file locally
   */
  downloadExcelLocally(
    guards: { name: string }[],
    salaryData: Record<string, Record<string, Record<string, number>>>,
    fileName: string = this.DEFAULT_FILE_NAME
  ): void {
    const excelBlob = this.exportToExcel(guards, salaryData, fileName);
    const url = URL.createObjectURL(excelBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Format salary data for Excel export
   */
  private formatSalaryDataForExcel(
    salaryData: Record<string, Record<string, Record<string, number>>>,
    guards: { name: string }[]
  ): any[] {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const rows: any[] = [];
    const years = Object.keys(salaryData).sort().reverse();

    guards.forEach((guard) => {
      years.forEach((year) => {
        const row: any = {
          'Guard Name': guard.name,
          'Year': year,
        };

        let total = 0;
        months.forEach((month, index) => {
          const monthKey = (index + 1).toString().padStart(2, '0');
          const amount = salaryData[year]?.[guard.name]?.[monthKey] || 0;
          row[month] = amount;
          total += amount;
        });

        row['Total'] = total;
        rows.push(row);
      });
    });

    return rows;
  }

  /**
   * Parse salary data from Excel
   */
  private parseSalaryDataFromExcel(
    salaryRows: any[]
  ): Record<string, Record<string, Record<string, number>>> {
    const salaryData: Record<string, Record<string, Record<string, number>>> = {};
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    salaryRows.forEach((row) => {
      const guardName = row['Guard Name'];
      const year = row['Year']?.toString();

      if (guardName && year) {
        if (!salaryData[year]) {
          salaryData[year] = {};
        }
        if (!salaryData[year][guardName]) {
          salaryData[year][guardName] = {};
        }

        months.forEach((month, index) => {
          const monthKey = (index + 1).toString().padStart(2, '0');
          const amount = row[month];
          if (amount !== undefined && amount !== null && amount !== '') {
            salaryData[year][guardName][monthKey] = Number(amount) || 0;
          }
        });
      }
    });

    return salaryData;
  }

  /**
   * Create salary change summary
   */
  private createSalaryChangeSummary(
    salaryData: Record<string, Record<string, Record<string, number>>>,
    guards: { name: string }[]
  ): any[] {
    const summaryData: any[] = [];
    const years = Object.keys(salaryData).sort().reverse();

    guards.forEach((guard) => {
      const guardSalaries: { [year: string]: number } = {};
      years.forEach((year) => {
        const total = Object.values(salaryData[year]?.[guard.name] || {}).reduce((sum, amt) => sum + (amt || 0), 0);
        guardSalaries[year] = total;
      });

      summaryData.push({
        'Guard Name': guard.name,
        'Current Year Total (₹)': guardSalaries[years[0]] || 0,
        'Previous Year Total (₹)': guardSalaries[years[1]] || 0,
        'Change (%)': guardSalaries[years[0]] ? ((guardSalaries[years[0]] - (guardSalaries[years[1]] || 0)) / (guardSalaries[years[1]] || 1) * 100).toFixed(2) : '0',
      });
    });

    return summaryData;
  }

  /**
   * Get Google Drive file info from URL
   */
  async getGoogleDriveFileInfo(): Promise<any> {
    try {
      if (!this.fileUrl) {
        throw new Error('Please set Google Drive file URL first');
      }

      const fileId = this.googleDriveService.extractFileId(this.fileUrl);
      if (!fileId) {
        throw new Error('Invalid Google Drive URL format');
      }

      return {
        fileId: fileId,
        fileUrl: this.fileUrl,
        downloadUrl: this.googleDriveService.getDownloadUrl(fileId),
        message: 'File URL is set and ready for import/export'
      };
    } catch (error) {
      throw error;
    }
  }
}
