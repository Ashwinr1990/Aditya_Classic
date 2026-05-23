import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class GoogleDriveService {

  /**
   * Extract file ID from Google Drive URL
   * Supports formats:
   * - https://drive.google.com/file/d/FILE_ID/view
   * - https://drive.google.com/file/d/FILE_ID
   * - FILE_ID (direct ID)
   */
  extractFileId(urlOrId: string): string {
    if (!urlOrId) return '';
    
    // If it's already just an ID
    if (!urlOrId.includes('/')) {
      return urlOrId;
    }
    
    // Extract from URL
    const match = urlOrId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : '';
  }

  /**
   * Get direct download URL from Google Drive file ID
   */
  getDownloadUrl(fileId: string): string {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  /**
   * Get Google Sheets export URL (if file is a Google Sheet)
   */
  getSheetsExportUrl(fileId: string): string {
    return `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`;
  }

  /**
   * Download file from Google Drive using file ID
   */
  async downloadFile(fileId: string): Promise<ArrayBuffer> {
    try {
      const url = this.getDownloadUrl(fileId);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      return await response.arrayBuffer();
    } catch (error) {
      console.error('File download failed:', error);
      throw error;
    }
  }

  /**
   * Download file from Google Sheets if it's a Google Sheet
   */
  async downloadSheetAsExcel(fileId: string): Promise<ArrayBuffer> {
    try {
      const url = this.getSheetsExportUrl(fileId);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Sheet export failed: ${response.statusText}`);
      }

      return await response.arrayBuffer();
    } catch (error) {
      console.error('Sheet export failed:', error);
      // Fallback to regular download
      return await this.downloadFile(fileId);
    }
  }

  /**
   * Get file metadata (requires public sharing or proper permissions)
   */
  async getFileMetadata(fileId: string): Promise<any> {
    try {
      // Try to get metadata via Drive API (may fail without auth)
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,webViewLink`
      );
      
      if (response.ok) {
        return await response.json();
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get file metadata:', error);
      return null;
    }
  }

  /**
   * Create a permanent link to upload file to Google Drive folder
   * Returns instructions for manual upload
   */
  getUploadInstructions(fileId: string): string {
    return `
    To update the file in Google Drive:
    1. Click the download button to save ACMT.xlsx
    2. Go to Google Drive: https://drive.google.com/file/d/${fileId}
    3. Right-click and select "Manage versions"
    4. Upload the new file version
    
    Or simply right-click the file and replace it.
    `;
  }
}

