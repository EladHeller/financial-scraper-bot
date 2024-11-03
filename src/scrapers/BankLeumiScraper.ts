import { Page } from 'playwright';
import { AccountData } from '../shared-types';

interface ScraperConfig {
  username: string;
  password: string;
}

const BASE_URL = 'https://hb2.bankleumi.co.il';
const TRADE_URL = BASE_URL + '/lti/lti-app/home';
const MORTGAGE_URL = BASE_URL + '/ebanking/LoanAndMortgages/DisplayLoansAndMortgagesSummary.aspx';

export class BankLeumiScraper {
  private page: Page;
  private config: ScraperConfig;

  constructor(page: Page, config: ScraperConfig) {
    this.page = page;
    this.config = config;
  }

  async login(url: string): Promise<void> {
    try {
      await this.page.goto(url);
      const submitButon = this.page.getByRole('button', { name: 'כניסה לחשבון' });

      const isSubmitButtonVisible = await submitButon.isVisible();
      if (!isSubmitButtonVisible) {
        return;
      }
      
      // Wait for login form
      await this.page.getByPlaceholder('שם משתמש').waitFor({
        state: 'visible',
        timeout: 10000
      });
      
      // Fill login credentials
      await this.page.getByPlaceholder('שם משתמש').fill(this.config.username);
      await this.page.getByPlaceholder('סיסמה').fill(this.config.password);
      
      // Submit form
      await submitButon.click();
      
      await this.page.waitForSelector('body.consumer,#topMenu', { timeout: 10000 });
    } catch (error: any) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async scrapeTradeData(): Promise<AccountData[]> {
    try {
      await this.login(TRADE_URL);

      // Wait for account elements
      const summaryBar = this.page.locator('.summary-gallery');
      const accountSwitcher = this.page.locator('.portfolio-combo');
      const options = (await accountSwitcher.locator('.portfolio-combo-options [u1st-role="button"]').elementHandles()).length;
      
      const accounts: AccountData[] = [];

      for (let i = 0; i < options; i++) {
        if (i > 0) {
          await accountSwitcher.click();
          const option = accountSwitcher.locator('.portfolio-combo-options [u1st-role="button"]').nth(i);
          await option.click();
          await this.page.waitForSelector('.loading', { timeout: 10000 });
          await this.page.waitForSelector('.loading', { state: 'hidden', timeout: 10000 });
        }
        const accountName = await summaryBar.locator('.portfolio-combo-selected').textContent();
        const balanceText = await summaryBar.locator('.card.ng-star-inserted:first-child .number').textContent();
        const freeAmountText = await summaryBar.locator('.card.ng-star-inserted:last-child .number').textContent();
        
        // Convert balance string to number
        const balance = parseFloat(balanceText?.replace(/[^0-9.-]+/g, '') || '0');
        const freeAmount = parseFloat(freeAmountText?.replace(/[^0-9.-]+/g, '') || '0');
        
        accounts.push({
          accountName: accountName?.trim() || 'Unknown Account',
          balance: balance,
          freeAmount: freeAmount,
          lastUpdated: new Date()
        });
      }

      return accounts;
    } catch (error: any) {
      throw new Error(`Data scraping failed: ${error.message}`);
    }
  }
  
  async scrapeMortgageData(): Promise<AccountData> {
    try {
      await this.login(BASE_URL);
      // Wait for mortgage elements
      await this.page.getByRole('menuitem', {
        name: 'הלוואות, משכנתאות וערבויות'
      }).waitFor({ state: 'visible', timeout: 10000 });

      await this.page.goto(MORTGAGE_URL);
      
      const balanceText = await this.page.locator('.boldInExcel:nth-child(3)').textContent();
      const balance = -parseFloat(balanceText?.replace(/[^0-9.-]+/g, '') || '0');
      const lastUpdated = new Date();        
      return {
        accountName: 'Mortgage',
        balance,
        lastUpdated
      };
    } catch (error: any) {
      throw new Error(`Mortgage scraping failed: ${error.message}`);
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