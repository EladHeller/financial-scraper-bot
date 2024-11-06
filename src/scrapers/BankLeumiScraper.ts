import type { Page } from 'puppeteer';
import type { Page as CorePage } from 'puppeteer-core';
import { AccountData } from '../shared-types';

interface ScraperConfig {
  username: string;
  password: string;
}

const BASE_URL = 'https://hb2.bankleumi.co.il';
const TRADE_URL = BASE_URL + '/lti/lti-app/home';
const MORTGAGE_URL = BASE_URL + '/ebanking/LoanAndMortgages/DisplayLoansAndMortgagesSummary.aspx';

export class BankLeumiScraper {
  private page: Page | CorePage;
  private config: ScraperConfig;

  constructor(page: Page | CorePage, config: ScraperConfig) {
    this.page = page;
    this.config = config;
  }

  async login(url: string): Promise<void> {
    const page = this.page as Page;
    try {
      await page.goto(url);
      
      const submitButton = await page.$('button[type="submit"]');
      if (!submitButton) {
        return;
      }

      await page.waitForSelector('input[placeholder="שם משתמש"]', {
        visible: true,
        timeout: 10000
      });
      
      await page.type('input[placeholder="שם משתמש"]', this.config.username);
      await page.type('input[placeholder="סיסמה"]', this.config.password);
      
      await submitButton.click();
      
      await page.waitForSelector('body.consumer,#topMenu', { 
        visible: true,
        timeout: 10000 
      });
      console.log('Logged in successfully');
    } catch (e) {
      const error = e as Error;
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async scrapeTradeData(): Promise<AccountData[]> {
    const page = this.page as Page;
    try {
      await this.login(TRADE_URL);

      const accounts: AccountData[] = [];
      
      await page.waitForSelector('.summary-gallery');
      
      const accountOptions = await page.$$('.portfolio-combo-options [u1st-role="button"]');
      
      for (let i = 0; i < accountOptions.length; i++) {
        if (i > 0) {
          await page.click('.portfolio-combo');
          await page.waitForSelector('.portfolio-combo-options [u1st-role="button"]');
          await accountOptions[i].click();
          await page.waitForSelector('.loading');
          await page.waitForSelector('.loading', { hidden: true });
        }

        const accountName = await page.$eval(
          '.portfolio-combo-selected',
          el => el.textContent?.trim() || 'Unknown Account'
          
        );
        await page.waitForSelector('.card.ng-star-inserted:first-child .number');
        const balanceText = await page.$eval(
          '.card.ng-star-inserted:first-child .number',
          el => el.textContent || '0',

        );

        const freeAmountText = await page.$eval(
          '.card.ng-star-inserted:last-child .number',
          el => el.textContent || '0'
        );

        const balance = parseFloat(balanceText.replace(/[^0-9.-]+/g, '') || '0');
        const freeAmount = parseFloat(freeAmountText.replace(/[^0-9.-]+/g, '') || '0');

        accounts.push({
          accountName,
          balance,
          freeAmount,
          lastUpdated: new Date()
        });
      }

      return accounts;
    } catch (e) {
      const error = e as Error;
      throw new Error(`Data scraping failed: ${error.message}`);
    }
  }

  async scrapeMortgageData(): Promise<AccountData> {
    const page = this.page as Page;
    try {
      await this.login(BASE_URL);
      
      await page.goto(MORTGAGE_URL);
      
      const balanceText = await page.$eval(
        '.boldInExcel:nth-child(3)',
        el => el.textContent || '0'
      );
      
      const balance = -parseFloat(balanceText.replace(/[^0-9.-]+/g, '') || '0');
      
      return {
        accountName: 'Mortgage',
        balance,
        lastUpdated: new Date()
      };
    } catch (e) {
      const error = e as Error;
      throw new Error(`Mortgage scraping failed: ${error.message}`);
    }
  }
}