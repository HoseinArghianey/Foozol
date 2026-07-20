const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

/**
 * یک مرورگر headless راه‌اندازی می‌کند با استفاده از @sparticuz/chromium —
 * پکیجی که باینری فشرده‌ی Chromium را به‌عنوان یک dependency معمولی npm همراه
 * می‌آورد (نه یک دانلود جداگانه)، و در لحظه‌ی اجرا آن را در /tmp استخراج می‌کند.
 *
 * این روش عمداً جایگزین puppeteer معمولی شد چون روی هاست‌های رایگان (مثل
 * Render Free) که build و runtime ممکن است فضای فایل جداگانه داشته باشند،
 * دانلود جداگانه‌ی کروم به‌طور غیرقابل‌اعتمادی بین این دو مرحله گم می‌شد.
 * چون node_modules به‌طور کامل و قابل‌اعتماد منتقل می‌شود، این روش دیگر به
 * چنین مشکلی برخورد نمی‌کند.
 */
async function launchBrowser() {
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
}

module.exports = { launchBrowser };
