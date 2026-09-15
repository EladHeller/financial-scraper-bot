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

      const updates = rowsAndIds.flatMap(({ id, row }) => {
        const accountData = data.find(account => account.accountName.trim() === id);
        return accountData && Number.isFinite(accountData.balance) ? [{ accountData, row }] : [];
      });
      const skippedAccounts = data.filter(account => !updates.some(update => update.accountData === account));
      if (skippedAccounts.length) {
        console.warn('Google Sheet accounts skipped (missing mapping or invalid balance):',
          skippedAccounts.map(account => account.accountName));
      }
      if (!updates.length) {
        throw new Error('No accounts updated. Check account IDs and destination rows in Finance!Q6:R, and scraped balances.');
      }

      await Promise.all(updates.map(async ({ accountData, row }) => {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.config.spreadsheetId,
          range: `Finance!${BALANCE_COLUMN}${row}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[accountData.balance.toString()]],
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
        if (accountData.freeAmount != null && Number.isFinite(accountData.freeAmount)) {
          await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.config.spreadsheetId,
            range: `Finance!${FREE_AMOUNT_COLUMN}${row}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [[accountData.freeAmount?.toString() ?? '']],
            },
          });
        }
      }));

      console.log(`Successfully updated Google Sheet: ${updates.length} account row(s), ${skippedAccounts.length} account(s) skipped`);
    } catch (e) {
      const error = e as Error;
      throw new Error(`Failed to update Google Sheet: ${error.message}`);
    }
  }
  
  async getRowsAndIds(): Promise<{id: string, row: string}[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: 'Finance!P6:Q',
      });

      const values = response.data.values;
      if (!values || values.length === 0) {
        return [];
      }

      return values.flatMap((cells, index) => {
        const id = String(cells[0] ?? '').trim();
        const row = String(cells[1] ?? '').trim();
        if (!id && !row) return [];
        if (!id || !/^[1-9]\d*$/.test(row)) {
          console.warn(`Skipping invalid account mapping at Finance!Q${index + 6}:R${index + 6}: expected an account ID in Q and a positive destination row number in R`);
          return [];
        }
        return [{ id, row }];
      });
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