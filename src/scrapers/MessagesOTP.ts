import { BrowserContext, Page } from "playwright";

const recievedRegex = /התקבלה ב-(\d{1,2} ב[א-ת]{3,10} \d{4}) בשעה (\d{1,2}):(\d{2})/;

export default class MessagesOTP {
    private context: BrowserContext;
    private page?: Page;
    
    constructor(context: BrowserContext) {
        this.context = context;
    }

    private async init() {
        this.page = await this.context.newPage();
        await this.page.goto('https://messages.google.com/web/conversations');
        await this.page.waitForSelector('mws-conversation-list-item .name');
    }

    async getOTP(name: string): Promise<string > {
        if (!this.page) {
            await this.init();
        }
        if (!this.page) {
            throw new Error('Failed to initialize page');
        }

        const items = await this.page.locator('mws-conversation-list-item .name', {
            hasText: name
        }).all();

        const item = items.filter(async (item) => {
            return (await item.textContent())?.trim() === name;
        });

        if (!item || item.length === 0) {
            throw new Error('Failed to find conversation');
        }
        await item[0].click();

        const mexRetries = 5;

        const otp = this.page.locator('mws-text-message-part');
        const now = new Date();
        const nowDate = `${now.toLocaleString('he', { month: 'long', day: 'numeric' })} ${now.getFullYear()}`;
        for (let i = 0; i < mexRetries; i++) {
            const lastMessage = await otp.last().getAttribute('aria-label');
            if (!lastMessage) {
                throw new Error('Failed to get last message');
            }
            const match = lastMessage.match(recievedRegex);
            if (!match) {
                throw new Error('Failed to match message');
            }
            const dateString = match[1];
            const hours = Number(match[2]);
            const minutes = Number(match[3]) + 1;
            if (dateString !== nowDate || hours < now.getHours() || (hours === now.getHours() && minutes < now.getMinutes())) {
                await this.page.waitForTimeout(3000);
            } else {
                const otpTextMatch = lastMessage.match(/(\d{6})/);
                if (!otpTextMatch || !otpTextMatch[1]) {
                    throw new Error('Failed to match OTP');
                }
                return otpTextMatch[1];
            }
        }

        throw new Error('Failed to get OTP');
    }

    async close() {
        if (this.page) {
            await this.page.close();
        }
    }
}