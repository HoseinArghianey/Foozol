/**
 * این ماژول تشخیص می‌دهد که آیا یک قطعه متن، «نویز» است
 * (تبلیغات، شمارنده‌های تعاملی مثل لایک/نظر/بازدید، دکمه‌های اشتراک‌گذاری و ...)
 * یا محتوای واقعی صفحه.
 *
 * این فیلتر به‌صورت مکمل روی خروجیِ Readability اجرا می‌شود (که خودش عمده‌ی
 * نویگیشن/سایدبار/تبلیغات را حذف می‌کند) تا موارد باقی‌مانده هم پاک شوند.
 */

const AD_PATTERNS = [
  /تبلیغ/i,
  /آگهی/i,
  /محتوای حمایت‌شده/i,
  /sponsor(ed)?/i,
  /advertisement/i,
  /\bads?\b/i,
  /دانلود اپلیکیشن/i,
  /نصب اپلیکیشن/i,
  /همین حالا خرید کنید/i,
  /کد تخفیف/i,
];

const INTERACTION_PATTERNS = [
  // شمارنده‌های تنهای عددی همراه کلمات تعاملی: «۱۲۳ لایک»، «دیدگاه: ۴»
  /^\s*[\d۰-۹,]+\s*(لایک|پسندیدن|دیدگاه|نظر|کامنت|بازدید|اشتراک‌گذاری|دنبال‌کننده|فالوور)s?\s*$/i,
  /^\s*(لایک|دیدگاه|نظر|بازدید|کامنت)\s*[:：]?\s*[\d۰-۹,]+\s*$/i,
  /^\s*(like|comment|view|share)s?\s*[:：]?\s*[\d,]+\s*$/i,
  // زمان نسبی تنها (بدون هیچ محتوای دیگر)، مثل «۳ دقیقه پیش»
  /^\s*[\d۰-۹]+\s*(دقیقه|ساعت|روز|ماه|سال)\s*(پیش)?\s*$/,
  // دعوت به تعامل
  /^\s*(ارسال نظر|ثبت دیدگاه|پاسخ به این نظر|نظر خود را بنویسید|وارد شوید تا نظر دهید)\s*$/i,
  /^\s*(لایک کنید|دنبال کنید|اشتراک بگذارید|به اشتراک بگذارید)\s*$/i,
  /^\s*(share|like|follow|comment)\s*$/i,
];

const BOILERPLATE_PATTERNS = [
  /^\s*(کلیه حقوق (این سایت|محفوظ است))/i,
  /^\s*(all rights reserved|copyright ©)/i,
  /^\s*(بازگشت به بالا|scroll to top)\s*$/i,
];

function isNoiseLine(line) {
  const trimmed = (line || '').trim();
  if (!trimmed) return true;
  if (AD_PATTERNS.some((p) => p.test(trimmed))) return true;
  if (INTERACTION_PATTERNS.some((p) => p.test(trimmed))) return true;
  if (BOILERPLATE_PATTERNS.some((p) => p.test(trimmed))) return true;
  return false;
}

module.exports = { isNoiseLine };
