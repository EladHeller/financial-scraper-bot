// src/services/googleSheets.ts

import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';
import { AccountData } from '../shared-types';

interface SheetConfig {
  spreadsheetId: string;
  credentials: {
    client_email: string;
    private_key: string;
  };
}

const BALANCE_COLUMN = 'F';
const DATE_COLUMN = 'J';
const FREE_AMOUNT_COLUMN = 'L';

export class GoogleSheetsService {
  private auth: JWT;
  private sheets: sheets_v4.Sheets;
  private config: SheetConfig;

  constructor(config: SheetConfig) {
    this.config = config;

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
      const rowsAndIds = await this.getRowsAndIds();

      await Promise.all(rowsAndIds.map(async ({id, row}) => {
        const accountData = data.find(account => account.accountName === id);

        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.config.spreadsheetId,
          range: `Finance!${BALANCE_COLUMN}${row}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[accountData?.balance.toString()]],
          },
        });
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.config.spreadsheetId,
          range: `Finance!${DATE_COLUMN}${row}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[date]],
          },
        });

        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.config.spreadsheetId,
          range: `Finance!${FREE_AMOUNT_COLUMN}${row}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[accountData?.freeAmount?.toString() ?? '']],
          },
        });
      }));

      console.log('Successfully updated Google Sheet');
    } catch (e) {
      const error = e as Error;
      throw new Error(`Failed to update Google Sheet: ${error.message}`);
    }
  }
  
  async getRowsAndIds(): Promise<{id: string, row: string}[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: 'Finance!Q6:R16',
      });

      const values = response.data.values;
      if (!values || values.length === 0) {
        return [];
      }

      return values.map(row => ({ id: row[0], row: row[1] }));
    } catch (e) {
      const error = e as Error;
      throw new Error(`Failed to get rows and ids: ${error.message}`);  
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
    } catch (e) {
      const error = e as Error;
      throw new Error(`Failed to get last update: ${error.message}`);
    }
  }
}