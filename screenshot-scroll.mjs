import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, 'temporary screenshots');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));

async function snap(label, scrollY) {
  await page.evaluate(y => window.scrollTo(0, y), scrollY);
  await new Promise(r => setTimeout(r, 700));
  const file = path.join(dir, `screenshot-sect-${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', file);
}

// hero
await snap('hero', 0);
// steps section (~4500px down - after phone showcase)
await snap('steps', 4500);
// chat section
await snap('chat', 6200);
// admin panel
await snap('admin', 8200);
// pricing
await snap('pricing', 10200);
// footer/cta
await snap('cta', 12000);

await browser.close();
