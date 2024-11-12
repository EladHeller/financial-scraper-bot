import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { BankLeumiScraper } from '../src/scrapers/BankLeumiScraper';
import MessagesOTP from '../src/scrapers/MessagesOTP';
import {MeitavScraper} from '../src/scrapers/MeitavScraper';
import {HarelScraper} from '../src/scrapers/HarelScraper';
import {MenoraScraper} from '../src/scrapers/MenoraScraper';
import {ClalScraper} from '../src/scrapers/ClalScraper';
import { GoogleSheetsService } from '../src/services/googleSheets';
import { AccountData } from '../src/shared-types';

dotenv.config();

async function runLocalScraper() {
  console.log('Starting local bank scraper...');
  
  const leumiConfig = {
    username: process.env.BANK_USERNAME!,
    password: process.env.BANK_PASSWORD!,
  };
  const meitavConfig = {
    identityNumber: process.env.IDENTITY_NUMBER!,
    phoneNumber: process.env.PHONE_NUMBER!,
  };

  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context  = browser.contexts()[0];
  const otpService = new MessagesOTP(context);
  const meitavScraper = new MeitavScraper(await context.newPage(), otpService, meitavConfig); 
  const menoraScraper = new MenoraScraper(await context.newPage(), otpService, meitavConfig); 
  const harelScraper = new HarelScraper(await context.newPage(), otpService, meitavConfig);
  const leumiScraper = new BankLeumiScraper(await context.newPage(), leumiConfig);
  const clalScraper = new ClalScraper(await context.newPage(), otpService, meitavConfig);
  const sheetsService = new GoogleSheetsService({
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID!,
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
      private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }
  });

  const scrapingData: AccountData[] = [];
  try {
    console.log('Starting data scraping...');

    const financialData = await leumiScraper.scrapeTradeData();
    scrapingData.push(...financialData);
    const mortgageData = await leumiScraper.scrapeMortgageData();
    scrapingData.push(mortgageData);
    await leumiScraper.close();

    const clalData = await clalScraper.scrapeData();
    scrapingData.push(clalData);
    await clalScraper.close();

    const menoraData = await menoraScraper.scrapeData();
    scrapingData.push(menoraData);
    await menoraScraper.close();

    const harelData = await harelScraper.scrapeData();
    scrapingData.push(harelData);
    await harelScraper.close();

    const meitavData = await meitavScraper.scrapeData();
    scrapingData.push(meitavData);
    await meitavScraper.close();

    
    console.log('Scraped data:', financialData, mortgageData, meitavData, harelData, menoraData);
  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    await otpService.close();
    await menoraScraper.close();
    await leumiScraper.close();
    await meitavScraper.close();
    await harelScraper.close();
    await browser.close();
  }

  if (scrapingData.length) {
    console.log('Updating Google Sheets...', scrapingData);
    await sheetsService.updateSheet(scrapingData);
  }
}

if (require.main === module) {
  runLocalScraper().catch(console.error);
}