import { Page } from 'playwright';
import { AccountData, OtpConfig, OTPService, Scraper } from '../shared-types';


const LOGIN_URL = 'https://online.as-invest.co.il/products/pension';

export class AltshulerScraper implements Scraper {
  private page: Page;
  private config: OtpConfig;
  private otpService: OTPService;

  get name(): string {
    return AltshulerScraper.name;
  }

  constructor(page: Page, otpService: OTPService, config: OtpConfig) {
    this.config = config;
    this.page = page;
    this.otpService = otpService;
  }

  async login(url: string): Promise<void> {
    try {
      await this.page.goto(url);
      const submitButon = this.page.getByRole('button', { name: 'שלחו לי סיסמה' });
      await this.page.waitForLoadState('domcontentloaded');
      const isSubmitButtonVisible = await submitButon.isVisible();
      if (!isSubmitButtonVisible) {
        return;
      }

      const idInput = this.page.getByPlaceholder('מספר ת.ז.');
      const otpWrapper = this.page.locator('app-code-input-control');
      
      // Wait for login form
      await idInput.waitFor({
        state: 'visible',
        timeout: 10000
      });
      const {identityNumber, phoneNumber} = this.config;

      await idInput.fill(identityNumber);
      await this.page.getByPlaceholder('מספר הטלפון שלי').fill(phoneNumber);
      // Submit form
      await submitButon.click();
      await otpWrapper.waitFor({ state: 'visible', timeout: 20000 });

      const otp = await this.otpService.getOTP('Altshuler');
      for (let i = 0; i < otp.length; i++) {
        await otpWrapper.getByRole('textbox').nth(i).fill(otp[i]);
      }
      await this.page.getByRole('button', {name: "קחו אותי לאזור האישי"}).click();
      
      await this.page.waitForSelector('app-pension-product-box', { timeout: 10000 });
    } catch (e) {
      const error = e as Error;
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async scrapeData(): Promise<AccountData[]> {
    try {
      await this.login(LOGIN_URL);
      await this.page.waitForSelector('app-pension-product-box', { timeout: 10000 });


      const accounts = await this.page.locator('app-pension-product-box').count();

      if (accounts === 0) {
        throw new Error('No accounts found');
      }

      const accountsData: AccountData[] = [];

      for (let i = 0; i < accounts; i++) {
        const account = this.page.locator('app-pension-product-box').nth(i);
        const accountNameText = await account.locator('.account-number').textContent();
        const accountName = accountNameText?.trim().match(/\d{1,30}/)?.[0];
        const amountText = await account.locator('.amount').first().innerText();
        const balance = Number(amountText.replace(/[,₪ ]/g, ''));
        if (isNaN(balance)) {
          throw new Error('Failed to get balance');
        }
        accountsData.push({
          accountName: accountName || '',
          balance,
          lastUpdated: new Date(),
        });
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