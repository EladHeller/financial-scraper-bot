import type { APIGatewayProxyResult } from 'aws-lambda';
import { chromium } from 'playwright-core';
import chrome from 'chrome-aws-lambda';
import { GoogleSheetsService } from './services/googleSheets';
import { BankLeumiScraper } from './scrapers/BankLeumiScraper';
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

async function getGoogleSheetsConfig() {
  const command = new GetParameterCommand({
    Name: process.env.GOOGLE_CREDENTIALS_PARAM,
    WithDecryption: true
  });
  const response = await ssm.send(command);
  return JSON.parse(response.Parameter?.Value || '{}');
}

export async function handler(): Promise<APIGatewayProxyResult> {
  const browser = await chromium.launch({
    headless: true,
    executablePath: await chrome.executablePath,
    args: chrome.args,
  });

  try {
    const page = await browser.newPage();
    const scraper = new BankLeumiScraper(page, await getBankCredentials());
    const sheetsService = new GoogleSheetsService(await getGoogleSheetsConfig());

    console.log('Starting data scraping...');
    const financialData = await scraper.scrapeTradeData();
    const mortgageData = await scraper.scrapeMortgageData();
    console.log('Updating Google Sheets...');
    await sheetsService.updateSheet([...financialData,mortgageData]);
  } catch (e) {
    console.error('Error during scraping:', e);
    const error = e as Error;
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error?.message ?? error })
    };
  } finally {
    await browser.close();
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Successfully updated financial data' })
  };
}