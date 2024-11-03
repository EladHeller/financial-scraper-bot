import { Page } from 'playwright';
import { AccountData, ScraperConfig } from '../shared-types';

export class BankScraper {
  private page: Page;
  private config: ScraperConfig;

  constructor(page: Page, config: ScraperConfig) {
    this.page = page;
    this.config = config;
  }

  async login(): Promise<void> {
    try {
      await this.page.goto(this.config.baseUrl);
      
      // Wait for login form
      await this.page.getByPlaceholder('שם משתמש').waitFor({
        state: 'visible',
        timeout: 10000
      });
      
      // Fill login credentials
      await this.page.getByPlaceholder('שם משתמש').fill(this.config.username);
      await this.page.getByPlaceholder('סיסמה').fill(this.config.password);
      
      // Submit form
      await this.page.getByRole('button', { name: 'כניסה לחשבון' }).click();
      
      // Wait for successful login
      await this.page.waitForSelector('.summary-number', { timeout: 10000 });
    } catch (error: any) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async scrapeData(): Promise<AccountData[]> {
    try {
      await this.login();

      // Wait for account elements
      const summaryBar = this.page.locator('.summary-gallery');
      const accountSwitcher = this.page.locator('.portfolio-combo');
      const options = (await accountSwitcher.locator('.portfolio-combo-options [u1st-role="button"]').elementHandles()).length;
      
      const accounts: AccountData[] = [];

      for (let i = 0; i < options; i++) {
        await accountSwitcher.click();
        const option = accountSwitcher.locator('.portfolio-combo-options [u1st-role="button"]').nth(i);
        await option.click();
        const accountName = await summaryBar.locator('.portfolio-combo-selected').textContent();
        const balanceText = await summaryBar.locator('.card.ng-star-inserted:first-child .number').textContent();
        const freeAmountText = await summaryBar.locator('.card.ng-star-inserted:last-child .number').textContent();
        
        // Convert balance string to number
        const balance = parseFloat(balanceText?.replace(/[^0-9.-]+/g, '') || '0');
        const freeAmount = parseFloat(freeAmountText?.replace(/[^0-9.-]+/g, '') || '0');
        
        accounts.push({
          accountName: accountName?.trim() || 'Unknown Account',
          balance: balance + freeAmount,
          lastUpdated: new Date()
        });
      }

      return accounts;
    } catch (error: any) {
      throw new Error(`Data scraping failed: ${error.message}`);
    }
  }

  async close(): Promise<void> {
    // Perform logout if needed
    try {
      await this.page.click('#logout-button');
      await this.page.waitForSelector('#login-username');
    } catch (error: any) {
      console.warn('Logout failed:', error.message);
    }
  }
}