import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { BankLeumiScraper } from '../src/scrapers/BankLeumiScraper';
import { GoogleSheetsService } from '../src/services/googleSheets';

dotenv.config();

async function runLocalScraper() {
  console.log('Starting local bank scraper...');
  
  const config = {
    username: process.env.BANK_USERNAME!,
    password: process.env.BANK_PASSWORD!,
  };

  const browser = await chromium.launch({
    headless: false, // Set to true for production
    slowMo: 100 // Slows down operations for debugging
  });

  try {
    const page = await browser.newPage();
    const scraper = new BankLeumiScraper(page, config);
    const sheetsService = new GoogleSheetsService({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID!,
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
        private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      }
    });

    console.log('Starting data scraping...');
    const financialData = await scraper.scrapeTradeData();
    const mortgageData = await scraper.scrapeMortgageData();
    
    console.log('Scraped data:', financialData, mortgageData);
    
    if (process.env.UPDATE_SHEETS === 'true') {
      console.log('Updating Google Sheets...');
      await sheetsService.updateSheet([...financialData, mortgageData]);
    }

  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  runLocalScraper().catch(console.error);
}