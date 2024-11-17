export interface AccountData {
  accountName: string;
  balance: number;
  freeAmount?: number;
  lastUpdated: Date;
}
  

export interface Scraper {
  name: string;
  login(url: string): Promise<void>;
  scrapeData(): Promise<AccountData[]>;
  close(): Promise<void>;
  scrapeMortgageData?(): Promise<AccountData[]>;
}

export interface OtpConfig {
  identityNumber: string;
  phoneNumber: string;
}

export interface OTPService {
  getOTP(service: string): Promise<string>;
}

export interface BankConfig {
  username: string;
  password: string;
}