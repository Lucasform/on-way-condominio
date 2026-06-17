import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

// Desktop hero
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('https://onway-condominio.vercel.app/landing', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'C:/Users/lucas/Desktop/land-hero.png' });

// Features section
await page.evaluate(() => window.scrollTo(0, 1000));
await page.waitForTimeout(300);
await page.screenshot({ path: 'C:/Users/lucas/Desktop/land-features.png' });

// Pricing section
await page.evaluate(() => window.scrollTo(0, 2600));
await page.waitForTimeout(300);
await page.screenshot({ path: 'C:/Users/lucas/Desktop/land-pricing.png' });

// Mobile
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.screenshot({ path: 'C:/Users/lucas/Desktop/land-mobile-hero.png' });

await browser.close();
console.log('screenshots saved');
