import { Page } from 'playwright';
import { AccountData, OtpConfig, OTPService, Scraper } from '../shared-types';

const LOGIN_URL = 'https://www.harel-group.co.il/personal-info/my-harel/Pages/client-view.aspx';

export class HarelScraper implements Scraper {
  private page: Page;
  private config: OtpConfig;
  private otpService: OTPService;

  get name(): string {
    return HarelScraper.name;
  }

  constructor(page: Page, otpService: OTPService, config: OtpConfig) {
    this.config = config;
    this.page = page;
    this.otpService = otpService;
  }
  scrapeMortgageData?(): Promise<AccountData[]> {
    throw new Error('Method not implemented.');
  }

  async login(url: string): Promise<void> {
    try {
      await this.page.goto(url);
      const submitButon = this.page.getByRole('button', { name: 'המשך' });
      await this.page.waitForLoadState('domcontentloaded');
      const isSubmitButtonVisible = await submitButon.isVisible();
      if (!isSubmitButtonVisible) {
        return;
      }

      const idInput = this.page.getByLabel('מספר תעודת זהות');
      const otpInput = this.page.getByLabel('קוד').last();
      
      // Wait for login form
      await idInput.waitFor({
        state: 'visible',
        timeout: 10000
      });
      const {identityNumber, phoneNumber} = this.config;

      await idInput.fill(identityNumber);
      await this.page.getByLabel('מספר טלפון נייד').fill(phoneNumber);
      // Submit form
      await submitButon.click();
      await otpInput.waitFor({ state: 'visible', timeout: 20000 });

      const otp = await this.otpService.getOTP('HAREL');
      await otpInput.fill(otp);
      await submitButon.click();
      
      await this.page.waitForSelector('.all_wrapper_inner', { timeout: 10000 });
    } catch (e) {
      const error = e as Error;
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async scrapeData(): Promise<AccountData[]> {
    try {
      await this.login(LOGIN_URL);

      await this.page.waitForLoadState('domcontentloaded');
      const iframe = this.page.locator('iframe[title="תמונת לקוח"]');
      await iframe.waitFor({ state: 'visible', timeout: 20000 });


      let amountText = await iframe.contentFrame().locator('#pensionSavings .moneyFormat').innerText();
      let balance = Number(amountText.replace(/[,₪ ]/g, ''));
      const mexRetries = 5;
      for (let i = 0; i < mexRetries && isNaN(balance); i++) {
        await this.page.waitForTimeout(3000);
        amountText = await iframe.contentFrame().locator('#pensionSavings .moneyFormat').innerText();
        balance = Number(amountText.replace(/[,₪ ]/g, ''));
      }
      if (isNaN(balance)) {
        throw new Error('Failed to get balance');
      }
      return [{
        accountName: 'Harel',
        balance,
        lastUpdated: new Date(),
      }];
    } catch (e) {
      const error = e as Error;
      throw new Error(`Data scraping failed: ${error.message}`);
    }
  }
  

  async close(): Promise<void> {
    await this.page.close();
  }
}