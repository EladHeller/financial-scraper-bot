import { Page } from 'playwright';
import { AccountData, OtpConfig, OTPService, Scraper } from '../shared-types';


const LOGIN_URL = 'https://www.clalbit.co.il/Portfolio/';

export class ClalScraper implements Scraper { 
  private page: Page;
  private config: OtpConfig;
  private otpService: OTPService;

  get name(): string {
    return ClalScraper.name;
  }

  constructor(page: Page, otpService: OTPService, config: OtpConfig) {
    this.config = config;
    this.page = page;
    this.otpService = otpService;
  }

  async login(url: string): Promise<void> {
    try {
      await this.page.goto(url);
      const submitButon = this.page.getByRole('button', { name: 'שליחה' });
      await this.page.waitForLoadState('domcontentloaded');
      await this.page.waitForTimeout(2000);
      const isSubmitButtonVisible = await submitButon.isVisible();
      if (!isSubmitButtonVisible) {
        return;
      }

      const idInput = this.page.getByLabel('ת.ז/ח.פ');
      const otpInput = this.page.getByLabel('הזן את הקוד');
      
      // Wait for login form
      await idInput.waitFor({
        state: 'visible',
        timeout: 10000
      });
      const {identityNumber, phoneNumber} = this.config;

      await idInput.fill(identityNumber);
      await this.page.getByLabel('טלפון נייד').fill(phoneNumber);
      // Submit form
      await submitButon.click();
      await otpInput.waitFor({ state: 'visible', timeout: 20000 });

      const otp = await this.otpService.getOTP('Clal');
      await otpInput.fill(otp);
      await this.page.getByRole('button', {name: "כניסה לחשבון"}).click();
      
      await this.page.waitForSelector('.financial-data-sum', { timeout: 10000 });
    } catch (e) {
      const error = e as Error;
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async scrapeData(): Promise<AccountData[]> {
    try {
      await this.login(LOGIN_URL);

      const accounts = await this.page.locator('app-policy-details-desktop').count();

      if (accounts === 0) {
        throw new Error('Failed to find accounts');
      }

      const accountsData: AccountData[] = [];

      for (let i = 0; i < accounts; i++) {
        const account = this.page.locator('app-policy-details-desktop').nth(i);
        const accountNameText = await account.locator('.link-content-num-policy').innerText();
        const accountName = accountNameText.trim().match(/\d{1,30}/)?.[0];
        if (!accountName) {
          throw new Error('Failed to get account name');
        }
        const balanceText = await account.locator('.financial-data-sum').innerText();
        const balance = Number(balanceText.replace(/[,₪ ]/g, ''));
        if (isNaN(balance)) {
          throw new Error('Failed to get balance');
        }
        accountsData.push({
          accountName,
          balance,
          lastUpdated: new Date(),
        });
      }

      return accountsData;
    } catch (e) {
      const error = e as Error;
      throw new Error(`Data scraping failed: ${error.message}`);
    }
  }
  

  async close(): Promise<void> {
    await this.page.close();
  }
}