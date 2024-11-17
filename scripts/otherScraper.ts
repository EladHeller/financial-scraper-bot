import { chromium } from 'playwright';
import ScraperFactory from '../src/scrapers/ScraperFactory';
import MessagesOTP from '../src/scrapers/MessagesOTP';
import dotenv from 'dotenv';
import { AccountData } from '../src/shared-types';
import { GoogleSheetsService } from '../src/services/googleSheets';


dotenv.config();

async function runOtherScraper() {
    console.log('Starting other scraper...');
    const otpConfig = {
      identityNumber: process.env.IDENTITY_NUMBER1!,
      phoneNumber: process.env.PHONE_NUMBER1!,
    };
    const browser = await chromium.connectOverCDP('http://localhost:9299');
    const context  = browser.contexts()[0];
    const otpService = new MessagesOTP(context);
    const factory = ScraperFactory(otpService, otpConfig);
    const sheetsService = new GoogleSheetsService({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID!,
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
          private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        }
      });

    const accounts = process.env.ACCOUNTS_1?.split(',');
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts provided');
    }
    const scrapers = await Promise.all(accounts.map(async account => factory.getScraper(account, await context.newPage())));

    const scrapingData: AccountData[] = [];
    try {
        for (const scraper of scrapers) {
            const data = await scraper.scrapeData();
            scrapingData.push(...data);
        }
      } catch (error) {
        console.error('Error during scraping:', error);
      } finally {
        for (const scraper of scrapers) {
            await scraper.close();
        }
        await otpService.close();
        await browser.close();
      }
      console.log('Scraping finished', scrapingData);

      await sheetsService.updateSheet(scrapingData);
  }
  
  if (require.main === module) {
    runOtherScraper().catch(console.error);
  }