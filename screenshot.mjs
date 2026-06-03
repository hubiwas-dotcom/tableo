import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const url = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] || '';

const screenshotsDir = path.join(__dirname, 'temporary screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Auto-increment filename
let n = 1;
let filename;
while (true) {
  filename = label
    ? path.join(screenshotsDir, `screenshot-${n}-${label}.png`)
    : path.join(screenshotsDir, `screenshot-${n}.png`);
  if (!fs.existsSync(filename)) break;
  n++;
}

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: filename, fullPage: true });
await browser.close();

console.log(`Screenshot saved: ${filename}`);
