const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

const USER_AGENT =
  'Mozilla/5.0 (compatible; RasadLinkBot/1.0; +https://rasadlink.example.com/bot)';

// سلکتورهایی که پیش از استخراج «محتوای متنی اصلی» حذف می‌شوند: تبلیغات، اسکریپت‌ها،
// بخش نظرات، دکمه‌های اشتراک‌گذاری، ناوبری و فوتر. این‌ها معمولاً باعث «تغییر کاذب» می‌شوند.
// توجه: این لیست فقط برای استخراج متن استفاده می‌شود، نه برای استخراج لینک/تصویر
// (چون لینک/بنر جدید معمولاً دقیقاً توی nav یا header ظاهر می‌شود و نباید حذف شود).
const TEXT_JUNK_SELECTORS = [
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

// سلکتورهای حذف‌شده پیش از استخراج «لینک/تصویر»: فقط موارد صرفاً تبلیغاتی/اسکریپتی،
// عمداً nav/footer را حذف نمی‌کنیم چون دقیقاً همان‌جا لینک/بنر جدید ظاهر می‌شود.
const LINK_JUNK_SELECTORS = [
  'script',
  'style',
  'noscript',
  'ins.adsbygoogle',
  '[class*="advert" i]',
  '[id*="advert" i]',
  '[class*="ad-banner" i]',
  '[class*="ad-container" i]',
  '[class*="cookie" i]',
];

/**
 * صفحه را با یک درخواست HTTP ساده (بدون مرورگر) می‌گیرد. این روش بسیار سبک‌تر
 * از Puppeteer است (چند صدم ثانیه در برابر ۲۰-۳۰ ثانیه) و برای رصدِ مقیاسِ
 * صدها/هزاران لینک ضروری است. محدودیتش این است که جاوااسکریپت صفحه اجرا
 * نمی‌شود؛ برای سایت‌هایی که کاملاً با JS رندر می‌شوند (SPA خالص)، محتوای
 * اولیه ممکن است ناقص باشد — این مورد نادر است و اکثر سایت‌های خبری/فروشگاهی
 * HTML اولیه‌ی معناداری برمی‌گردانند.
 */
async function fetchPageHtml(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`پاسخ HTTP نامعتبر: ${res.status}`);
    }
    const html = await res.text();
    return html;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * از HTML خام، محتوای اصلی مقاله/صفحه را (بدون نویگیشن، تبلیغات، نظرات) استخراج می‌کند.
 */
function extractMainContent(html, url) {
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;

  TEXT_JUNK_SELECTORS.forEach((selector) => {
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

/**
 * آدرس نسبی را به مطلق تبدیل و نرمال‌سازی می‌کند (حذف #hash، حذف / انتهایی اضافه).
 * در صورت نامعتبر بودن آدرس، null برمی‌گرداند.
 */
function normalizeUrl(rawUrl, baseUrl) {
  try {
    const u = new URL(rawUrl, baseUrl);
    u.hash = '';
    let s = u.toString();
    if (s.endsWith('/') && s.length > 1) s = s.slice(0, -1);
    return s;
  } catch (err) {
    return null;
  }
}

/**
 * از HTML، تمام لینک‌های داخلی (همان دامنه) و آدرس تصاویر را استخراج می‌کند.
 * این برای تشخیص «صفحه/لینک جدید» و «تصویر/بنر جدید» استفاده می‌شود —
 * مستقل از diff متنیِ محتوای اصلی.
 */
function extractLinksAndImages(html, url) {
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;
  const baseHost = new URL(url).hostname;

  LINK_JUNK_SELECTORS.forEach((selector) => {
    try {
      document.querySelectorAll(selector).forEach((el) => el.remove());
    } catch (err) {
      // نادیده گرفته می‌شود
    }
  });

  const links = new Set();
  document.querySelectorAll('a[href]').forEach((a) => {
    const normalized = normalizeUrl(a.getAttribute('href'), url);
    if (!normalized) return;
    try {
      // فقط لینک‌های داخلی (همان دامنه) در نظر گرفته می‌شوند تا لینک‌های
      // تبلیغاتی/شبکه‌اجتماعی خارجی نویز تولید نکنند
      if (new URL(normalized).hostname === baseHost) {
        links.add(normalized);
      }
    } catch (err) {
      // نادیده گرفته می‌شود
    }
  });

  const images = new Set();
  document.querySelectorAll('img[src]').forEach((img) => {
    const normalized = normalizeUrl(img.getAttribute('src'), url);
    if (normalized) images.add(normalized);
  });

  return {
    links: Array.from(links).sort(),
    images: Array.from(images).sort(),
  };
}

module.exports = { fetchPageHtml, extractMainContent, extractLinksAndImages };
