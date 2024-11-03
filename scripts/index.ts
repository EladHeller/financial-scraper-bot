import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { BankScraper } from '../src/scrapers/bankScraper';
import { bankUrl } from '../src/shared-configuration';
import { GoogleSheetsService } from '../src/services/googleSheets';

dotenv.config();

async function runLocalScraper() {
  console.log('Starting local bank scraper...');
  
  const config = {
    username: process.env.BANK_USERNAME!,
    password: process.env.BANK_PASSWORD!,
    baseUrl: bankUrl
  };

  const browser = await chromium.launch({
    headless: false, // Set to true for production
    slowMo: 100 // Slows down operations for debugging
  });

  try {
    const page = await browser.newPage();
    const scraper = new BankScraper(page, config);
    const sheetsService = new GoogleSheetsService();

    console.log('Starting data scraping...');
    const financialData = await scraper.scrapeData();
    
    console.log('Scraped data:', financialData);
    
    if (process.env.UPDATE_SHEETS === 'true') {
      console.log('Updating Google Sheets...');
      await sheetsService.updateSheet(financialData);
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