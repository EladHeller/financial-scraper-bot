import { Page } from 'playwright';
import { AccountData, OtpConfig, OTPService, Scraper } from '../shared-types';

const LOGIN_URL = 'https://customers.meitav.co.il/v2/login/loginAmit';

export class MeitavScraper implements Scraper {
  private page: Page;
  private config: OtpConfig;
  private otpService: OTPService;

  get name(): string {
    return MeitavScraper.name;
  }

  constructor(page: Page, otpService: OTPService, config: OtpConfig) {
    this.config = config;
    this.page = page;
    this.otpService = otpService;
  }

  async login(url: string): Promise<void> {
    try {
      await this.page.goto(url);
      const submitButon = this.page.getByRole('button', { name: 'אישור' });

      const isSubmitButtonVisible = await submitButon.isVisible();
      if (!isSubmitButtonVisible) {
        return;
      }
      
      // Wait for login form
      await this.page.getByPlaceholder('מספר תעודת זהות').waitFor({
        state: 'visible',
        timeout: 10000
      });
      const {identityNumber, phoneNumber} = this.config;

      const phonePrefix = phoneNumber.slice(0, 3);
      const phoneSuffix = phoneNumber.slice(3);
      
      await this.page.getByPlaceholder('מספר תעודת זהות').fill(identityNumber);
      await this.page.getByPlaceholder('מספר טלפון').fill(phoneSuffix);
      await this.page.selectOption('#id-phone-inputs select', phonePrefix);
      // Submit form
      await submitButon.click();

      const otp = await this.otpService.getOTP('Meitav');
      await this.page.getByPlaceholder('XXXXXX').fill(otp);
      await submitButon.click();
      
      await this.page.waitForSelector('.mainInfo', { timeout: 10000 });
    } catch (e) {
      const error = e as Error;
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async scrapeData(): Promise<AccountData[]> {
    try {
      await this.login(LOGIN_URL);

      // Wait for account elements
      const sumContainer = this.page.locator('.mainInfoItem .bigSum').first();
      await sumContainer.waitFor({ state: 'visible', timeout: 10000 });
      
      const amountText = await sumContainer.innerText();

      return [{
        accountName: 'Meitav',
        balance: Number(amountText.replace(/,/g, '')),
        lastUpdated: new Date(),
      }];
    } catch (e) {
      const error = e as Error;
      console.error('Data scraping failed', error);
      throw new Error(`Data scraping failed: ${error.message}`);
    }
  }
  

  async close(): Promise<void> {
    await this.page.close();
  }
}