# Google Drive Integration - URL-Based Setup

## ✨ Simplified Approach (No Client ID Required)

This version uses **only file URLs** - no authentication needed!

## Quick Start (2 Steps)

### Step 1: Prepare Your Google Drive File

1. **Create or Find Excel File in Google Drive**
   - Open [Google Drive](https://drive.google.com)
   - Create a new file or upload an Excel file
   - Name it: `SecuritySalaryData.xlsx` (recommended)

2. **Get the Shareable Link**
   - Right-click the file → **Share** (or click Share button)
   - Make sure it's accessible (can be with anyone)
   - Copy the link URL (should look like: `https://drive.google.com/file/d/1ABC123xyz/view`)

### Step 2: Add URL to Your App

1. **Start your Angular app**
   ```bash
   npm install
   npm start
   ```

2. **Go to Security → Salary page**

3. **Configure Google Drive URL**
   - Paste your file URL in the text field
   - Click **✓ Set URL**
   - You should see: "✓ File URL configured"

## How to Use

### Export Data to Google Drive
1. Click **☁️ Export to Drive**
2. Your data is sent to Google Drive
3. Download from Drive manually if needed

### Import Data from Google Drive
1. Click **☁️ Import from Drive**
2. Your latest data loads from the file

### Download Locally
1. Click **⬇️ Download Excel**
2. File saves to Downloads folder

### Import from Computer
1. Click **📁 Import File**
2. Select Excel file from your computer

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid Google Drive URL format" | Make sure URL follows: `https://drive.google.com/file/d/FILE_ID/view` |
| File not found error | Check that file exists in your Google Drive |
| Import fails | Make sure Excel file has "Guards" and "Salary Data" sheets |
| URL not saving | Check browser LocalStorage is enabled |

## File Format Requirements

Your Excel file should have these sheets:
- **Guards**: Column "Guard Name" with guard names
- **Salary Data**: Columns for each month (January-December) with amounts
- **Summary**: (Optional) Year comparison data

## Important Notes

✓ **No authentication needed**
✓ **Works offline** - data syncs when online
✓ **Simple URL-based** - just copy and paste
✓ **File is saved locally** in localStorage as backup

## Example File Structure

When you export, it creates this structure:

**Guards Sheet:**
```
Guard Name
Guard 1
Guard 2
```

**Salary Data Sheet:**
```
Guard Name | Year | January | February | ... | Total
Guard 1    | 2024 | 5000    | 5000     | ... | 60000
```

## Support

- Use the same file URL for all export/import operations
- File URL is saved in browser - you won't need to re-enter it
- All data is encrypted in localStorage on your device
