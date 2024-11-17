import dotenv from 'dotenv';
import { chromium } from 'playwright';
import MessagesOTP from '../src/scrapers/MessagesOTP';
import { GoogleSheetsService } from '../src/services/googleSheets';
import { AccountData } from '../src/shared-types';
import ScraperFactory from '../src/scrapers/ScraperFactory';

dotenv.config();

async function runLocalScraper() {
  console.log('Starting local bank scraper...');
  
  const bankConfig = {
    username: process.env.BANK_USERNAME!,
    password: process.env.BANK_PASSWORD!,
  };
  const otpConfig = {
    identityNumber: process.env.IDENTITY_NUMBER!,
    phoneNumber: process.env.PHONE_NUMBER!,
  };

  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context  = browser.contexts()[0];
  const otpService = new MessagesOTP(context);
  const factory = ScraperFactory(otpService, otpConfig, bankConfig);
  const accounts = process.env.ACCOUNTS?.split(',');
  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts provided');
  }
  const scrapers = await Promise.all(accounts.map(async account => factory.getScraper(account, await context.newPage())));
  const sheetsService = new GoogleSheetsService({
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID!,
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
      private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }
  });

  const scrapingData: AccountData[] = [];
  console.log('Starting data scraping...');
  for (const scraper of scrapers) {
    try {
      const data = await scraper.scrapeData();
      scrapingData.push(...data);
      if (scraper.scrapeMortgageData) {
        const mortgageData = await scraper.scrapeMortgageData();
        scrapingData.push(...mortgageData);
      }
    } catch (error) {
      console.error('Error during scraping:', scraper.name, error);
    }
  }
  await otpService.close();
  for (const scraper of scrapers) {
    await scraper.close();
  }
  await browser.close();

  if (scrapingData.length) {
    console.log('Updating Google Sheets...', scrapingData);
    await sheetsService.updateSheet(scrapingData);
  }
}

if (require.main === module) {
  runLocalScraper().catch(console.error);
}