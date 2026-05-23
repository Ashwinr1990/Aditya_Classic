# Google Drive Integration Setup Guide

## Overview
This document provides step-by-step instructions to set up Google Drive integration for automatic Excel export/import of Security Salary data.

## Features
- ✅ Authenticate with Google Drive
- ✅ Export salary data to Google Drive as Excel files
- ✅ Import salary data from Google Drive
- ✅ Download Excel files locally
- ✅ Import files from local machine
- ✅ Automatic file versioning with dates

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click **NEW PROJECT**
4. Enter project name: "ACMT Security Salary"
5. Click **CREATE**
6. Wait for the project to be created and select it

## Step 2: Enable Google Drive API

1. In the Cloud Console, go to **APIs & Services** > **Library**
2. Search for "Google Drive API"
3. Click on it and press **ENABLE**
4. You should see "API enabled" confirmation

## Step 3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
3. If prompted, configure the OAuth consent screen first:
   - Choose "External" for User Type
   - Fill in the required fields:
     - App name: "ACMT Security Salary"
     - User support email: Your email
     - Developer contact: Your email
   - Skip optional scopes and press **SAVE AND CONTINUE**
   - On Summary, click **BACK TO DASHBOARD**

4. Now create OAuth 2.0 Client ID:
   - Click **+ CREATE CREDENTIALS** > **OAuth client ID**
   - Select **Web application**
   - Give it a name: "ACMT Security Salary Web"
   - Under "Authorized JavaScript origins", add:
     ```
     http://localhost:4200
     http://localhost:4200/
     https://yourdomain.com
     https://yourdomain.com/
     ```
   - Under "Authorized redirect URIs", add:
     ```
     http://localhost:4200
     http://localhost:4200/
     https://yourdomain.com
     https://yourdomain.com/
     ```
   - Click **CREATE**

5. Copy the credentials (Client ID and Client Secret)

## Step 4: Update Application Configuration

1. Open `src/app/services/google-drive.service.ts`

2. Replace the placeholder values:
   ```typescript
   private readonly CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
   private readonly API_KEY = 'YOUR_API_KEY';
   ```

   With your actual credentials:
   - `CLIENT_ID`: Copy from OAuth 2.0 Client ID credentials
   - `API_KEY`: Go to Credentials > Create API Key > Restrict to Google Drive API

3. Your credentials should look like:
   ```typescript
   private readonly CLIENT_ID = '123456789-abcdefghijklmnop.apps.googleusercontent.com';
   private readonly API_KEY = 'AIzaSyD-xxxxxxxxxxxxx';
   ```

## Step 5: Test the Integration

1. Start your application:
   ```bash
   npm install
   npm start
   ```

2. Navigate to the Security > Salary page

3. Click **Connect to Google** button

4. You should see a Google login popup

5. After authentication, the buttons become available:
   - **☁️ Export to Drive**: Saves your data to Google Drive
   - **⬇️ Download Excel**: Downloads locally
   - **📁 Import File**: Import from your computer
   - **Refresh Files**: Lists files in Google Drive

## Features Explained

### Export to Google Drive
- Exports current guards and salary data
- Creates an Excel file with:
  - **Guards sheet**: List of all guards
  - **Salary Data sheet**: Monthly salary details
  - **Summary sheet**: Year-over-year comparison
- File is automatically named with today's date
- Updates existing file if it already exists

### Import from Google Drive
1. Click **Refresh Files** to load your Google Drive files
2. Select a file from the dropdown
3. Click **Import Selected File**
4. Your data will be loaded and saved locally

### Local Download/Import
- **Download Excel**: Downloads to your computer immediately
- **Import File**: Choose an Excel file from your computer to upload

## Troubleshooting

### "Failed to authenticate with Google"
- Check that your Client ID is correct
- Ensure localhost:4200 is in the authorized origins
- Check browser console for detailed error messages

### "File not found in Google Drive"
- Make sure you've exported at least once
- Click **Refresh Files** to reload the list
- Check that the file wasn't deleted from Drive

### CORS Errors
- Ensure all origins are properly configured in Google Cloud Console
- If deploying, add production domain to authorized origins

### "API not enabled"
- Go back to APIs & Services > Library
- Search for "Google Drive API" and ensure it's enabled

## File Format

The exported Excel file includes:

**Guards Sheet:**
| Guard Name |
|------------|
| Guard 1    |
| Guard 2    |

**Salary Data Sheet:**
| Guard Name | Year | January | February | ... | Total |
|------------|------|---------|----------|-----|-------|
| Guard 1    | 2024 | 5000    | 5000     | ... | 60000 |

**Summary Sheet:**
| Guard Name | Current Year Total | Previous Year Total | Change % |
|------------|--------------------|---------------------|----------|
| Guard 1    | 60000              | 55000               | 9.09     |

## Security Notes

⚠️ **Important:**
- Never commit `google-drive.service.ts` with actual credentials to public repositories
- Use environment variables for production
- Consider using Google Cloud Secret Manager for sensitive credentials
- The OAuth token is automatically managed by the Google Auth library

## Production Deployment

For production:
1. Add your production domain to authorized origins and redirect URIs
2. Move credentials to environment variables:
   ```typescript
   private readonly CLIENT_ID = environment.googleClientId;
   private readonly API_KEY = environment.googleApiKey;
   ```
3. Update `angular.json` to use environment-specific configurations

## Support

For issues with:
- **Google APIs**: Check [Google Cloud Documentation](https://developers.google.com/drive)
- **Angular**: Check [Angular Documentation](https://angular.io/docs)
- **XLSX Export**: Check [XLSX Documentation](https://docs.sheetjs.com/)
