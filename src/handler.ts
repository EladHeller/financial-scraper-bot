import type { Context, APIGatewayProxyResult } from 'aws-lambda';
import { chromium } from 'playwright';
import { GoogleSheetsService } from './services/googleSheets';
import { BankScraper } from './scrapers/bankScraper';
import { bankUrl } from './shared-configuration';
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({});

async function getBankCredentials() {
  const command = new GetParameterCommand({
    Name: process.env.BANK_CREDENTIALS_PARAM,
    WithDecryption: true
  });
  const response = await ssm.send(command);
  return JSON.parse(response.Parameter?.Value || '{}');
}

export async function handler(event: any, context: Context): Promise<APIGatewayProxyResult> {
  try {
    // Launch browser
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Initialize services
    const scraper = new BankScraper(page, {
        ...await getBankCredentials(),
        baseUrl: bankUrl
    });
    const sheetsService = new GoogleSheetsService();
    
    // Scrape data
    const financialData = await scraper.scrapeData();
    
    // Update Google Sheet
    await sheetsService.updateSheet(financialData);
    
    await browser.close();
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully updated financial data' })
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}