import { Page } from 'playwright';
import { AccountData, OtpConfig, OTPService, Scraper } from '../shared-types';
import MessagesOTP from './MessagesOTP';

const LOGIN_URL = 'https://www.menoramivt.co.il/customer-login/';

export class MenoraScraper implements Scraper {
  private page: Page;
  private config: OtpConfig;
  private otpService: OTPService;

  get name(): string {
    return MenoraScraper.name;
  }

  constructor(page: Page, otpService: OTPService, config: OtpConfig) {
    this.config = config;
    this.page = page;
    this.otpService = otpService;
  }

  async login(url: string): Promise<void> {
    try {
      await this.page.goto(url);
      const submitButon = this.page.getByRole('button', { name: 'שלחו לי קוד בהודעה' });
      await this.page.waitForLoadState('domcontentloaded');
      const isSubmitButtonVisible = await submitButon.isVisible();
      if (!isSubmitButtonVisible) {
        return;
      }

      const idInput = this.page.getByLabel('מספר זהות');
      const otpWrapper = this.page.locator('.otpWrapper');

      // Wait for login form
      await idInput.waitFor({
        state: 'visible',
        timeout: 10000
      });
      const { identityNumber, phoneNumber } = this.config;

      await idInput.fill(identityNumber);
      await this.page.getByLabel('טלפון / דוא"ל').fill(phoneNumber);
      // Submit form
      await submitButon.click();
      await otpWrapper.waitFor({ state: 'visible', timeout: 20000 });

      const otp = await this.otpService.getOTP('MenoraMivt');
      for (let i = 0; i < otp.length; i++) {
        await this.page.locator('.otpWrapper input').nth(i).fill(otp[i]);
      }
      await this.page.getByRole('button', { name: "אישור" }).click();

      await this.page.waitForSelector('.sec-text', { timeout: 10000 });
    } catch (e) {
      const error = e as Error;
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async scrapeData(): Promise<AccountData[]> {
    try {
      await this.login(LOGIN_URL);
      await this.page.waitForSelector('.sec-text', { timeout: 10000 });


      const accounts = await this.page.locator('.strips-container').count();

      if (accounts === 0) {
        throw new Error('No accounts found');
      }

      const accountsData: AccountData[] = [];

      for (let i = 0; i < accounts; i++) {
        const account = this.page.locator('.strips-container').nth(i);
        const accountNameText = await account.locator('.strip-sub-title').textContent();
        const accountName = accountNameText?.trim().match(/\d{1,30}/)?.[0];
        const amountText = await account.locator('.sec-text').first().innerText();
        const balance = Number(amountText.replace(/[,₪ ]/g, ''));
        if (isNaN(balance)) {
          console.log('Failed to get balance', accountName);
        } else {
          accountsData.push({
            accountName: accountName || '',
            balance,
            lastUpdated: new Date(),
          });
        }
      }

      return accountsData
    } catch (e) {
      const error = e as Error;
      throw new Error(`Data scraping failed: ${error.message}`);
    }
  }


  async close(): Promise<void> {
    await this.page.close();
  }
}