const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

/**
 * یک مرورگر headless راه‌اندازی می‌کند با استفاده از @sparticuz/chromium —
 * پکیجی که باینری فشرده‌ی Chromium را به‌عنوان یک dependency معمولی npm همراه
 * می‌آورد (نه یک دانلود جداگانه)، و در لحظه‌ی اجرا آن را در /tmp استخراج می‌کند.
 *
 * فلگ‌های اضافه‌شده (--single-process، --disable-dev-shm-usage و...) برای
 * کاهش مصرف RAM هستند — چون Render Free فقط ۵۱۲ مگابایت RAM دارد و بدون این
 * فلگ‌ها، سرویس با خطای Out-of-Memory کرش می‌کند.
 */
async function launchBrowser() {
  return puppeteer.launch({
    args: [
      ...chromium.args,
      '--single-process',
      '--no-zygote',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
    ],
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
}

module.exports = { launchBrowser };
