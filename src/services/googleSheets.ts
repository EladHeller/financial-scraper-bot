// src/services/googleSheets.ts

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { AccountData } from '../shared-types';

interface SheetConfig {
  spreadsheetId: string;
  credentials: {
    client_email: string;
    private_key: string;
  };
}

export class GoogleSheetsService {
  private auth: JWT;
  private sheets: any;
  private config: SheetConfig;

  constructor() {
    this.config = {
      spreadsheetId: process.env.GOOGLE_SHEETS_ID!,
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
        private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      }
    };

    this.auth = new JWT({
      email: this.config.credentials.client_email,
      key: this.config.credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  async updateSheet(data: AccountData[]): Promise<void> {
    try {
      const date = new Date().toISOString().split('T')[0];
      
      // Prepare rows for update
      const rows = data.map(account => [
        date,
        account.accountName,
        account.balance.toString(),
      ]);

      // Append data to sheet
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.config.spreadsheetId,
        range: 'Finance!Q:S', // Adjust range as needed
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: rows,
        },
      });

      console.log('Successfully updated Google Sheet');
    } catch (error: any) {
      throw new Error(`Failed to update Google Sheet: ${error.message}`);
    }
  }

  async getLastUpdate(): Promise<string | null> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: 'Finance!A2:A',
      });

      const values = response.data.values;
      if (!values || values.length === 0) {
        return null;
      }

      return values[values.length - 1][0];
    } catch (error: any) {
      throw new Error(`Failed to get last update: ${error.message}`);
    }
  }
}