const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

const USER_AGENT =
  'Mozilla/5.0 (compatible; RasadLinkBot/1.0; +https://rasadlink.example.com/bot)';

// سلکتورهایی که پیش از استخراج محتوای اصلی حذف می‌شوند: تبلیغات، اسکریپت‌ها،
// بخش نظرات، دکمه‌های اشتراک‌گذاری و بنرها. این‌ها معمولاً باعث «تغییر کاذب» می‌شوند.
const JUNK_SELECTORS = [
  'script',
  'style',
  'noscript',
  'iframe',
  'ins.adsbygoogle',
  '[class*="advert" i]',
  '[id*="advert" i]',
  '[class*="banner-ad" i]',
  '[class*="ad-banner" i]',
  '[class*="ad-container" i]',
  '[class*="cookie" i]',
  '[class*="comment" i]',
  '[id*="comment" i]',
  '[class*="social-share" i]',
  '[class*="share-buttons" i]',
  '[class*="related-posts" i]',
  '[class*="newsletter" i]',
  '[class*="popup" i]',
  'nav',
  'footer',
];

/**
 * صفحه را با مرورگر headless بارگذاری می‌کند و HTML رندرشده + اسکرین‌شات کامل صفحه را برمی‌گرداند.
 * @param {import('puppeteer').Browser} browser
 * @param {string} url
 * @param {number} timeoutMs
 */
async function fetchPageData(browser, url, timeoutMs = 30000) {
  const page = await browser.newPage();
  try {
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1366, height: 900 });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: timeoutMs });

    // کمی مکث برای محتوای lazy-load شده
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const html = await page.content();
    const screenshotBuffer = await page.screenshot({ fullPage: true, type: 'png' });

    return { html, screenshotBuffer };
  } finally {
    await page.close();
  }
}

/**
 * از HTML خام، محتوای اصلی مقاله/صفحه را (بدون نویگیشن، تبلیغات، نظرات) استخراج می‌کند.
 */
function extractMainContent(html, url) {
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;

  JUNK_SELECTORS.forEach((selector) => {
    try {
      document.querySelectorAll(selector).forEach((el) => el.remove());
    } catch (err) {
      // برخی سلکتورها ممکن است در DOMهای غیرمعمول خطا بدهند؛ نادیده گرفته می‌شود
    }
  });

  let text = '';
  try {
    const reader = new Readability(document);
    const article = reader.parse();
    text = article && article.textContent ? article.textContent : '';
  } catch (err) {
    text = '';
  }

  if (!text) {
    // اگر Readability نتوانست مقاله را تشخیص دهد (مثلاً صفحات لیستی)، به body برمی‌گردیم
    text = document.body ? document.body.textContent || '' : '';
  }

  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

module.exports = { fetchPageData, extractMainContent };
