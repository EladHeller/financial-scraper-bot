import { Page } from "playwright";
import { BankConfig, OtpConfig, OTPService, Scraper } from "../shared-types";
import { MenoraScraper } from "./MenoraScraper";
import { AltshulerScraper } from "./AltshulerScraper";
import { ClalScraper } from "./ClalScraper";
import { HarelScraper } from "./HarelScraper";
import { MeitavScraper } from "./MeitavScraper";
import { BankLeumiScraper } from "./BankLeumiScraper";

interface ScraperFactory {
    getScraper(scraperName: string, page: Page): Scraper;
}

export default function ScraperFactory(otpService: OTPService, otpConfig: OtpConfig, bankConfig?: BankConfig): ScraperFactory {
    function getScraper(scraperName: string, page: Page): Scraper {
      switch (scraperName) {
        case 'menora':
          return new MenoraScraper(page, otpService, otpConfig);
        case 'altshuler':
          return new AltshulerScraper(page, otpService, otpConfig);
        case 'clal':
            return new ClalScraper(page, otpService, otpConfig);
        case 'harel':
            return new HarelScraper(page, otpService, otpConfig);
        case 'meitav':
            return new MeitavScraper(page, otpService, otpConfig);
        case 'leumi':
            if (!bankConfig) {
                throw new Error('Bank config is required for Leumi scraper');
            }
            return new BankLeumiScraper(page, bankConfig);
        default:
          throw new Error(`Scraper ${scraperName} not supported`);
      }
    }

    return {
        getScraper
    }
}