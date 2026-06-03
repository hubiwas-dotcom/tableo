import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] || 'http://localhost:3000';
const scrollY = parseInt(process.argv[3] || '0', 10);
const label = process.argv[4] || 'section';

const screenshotsDir = path.join(__dirname, 'temporary screenshots');
if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

let n = 1;
let filename;
while (true) {
  filename = path.join(screenshotsDir, `screenshot-${n}-${label}.png`);
  if (!fs.existsSync(filename)) break;
  n++;
}

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1000));

// Force all reveal elements visible immediately
await page.addStyleTag({ content: '.reveal { opacity: 1 !important; transform: none !important; }' });

// Gradually scroll to trigger IntersectionObserver naturally
const steps = 20;
for (let i = 0; i <= steps; i++) {
  const pos = Math.round((scrollY / steps) * i);
  await page.evaluate(y => window.scrollTo(0, y), pos);
  await new Promise(r => setTimeout(r, 40));
}

await new Promise(r => setTimeout(r, 500));
await page.screenshot({ path: filename });
await browser.close();
console.log(`Saved: ${filename}`);
