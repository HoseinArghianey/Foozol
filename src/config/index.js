require('dotenv').config();
const path = require('path');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
const screenshotsDir = path.join(uploadsDir, 'screenshots');

module.exports = {
  port: parseInt(process.env.PORT, 10) || 4000,
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/rasadlink',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:4000',
  corsOrigins: (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim()),
  checkCron: process.env.CHECK_CRON || '*/12 * * * *', // هر ۱۲ دقیقه
  scrapeTimeoutMs: parseInt(process.env.SCRAPE_TIMEOUT_MS, 10) || 15000,
  minAddedChars: parseInt(process.env.MIN_ADDED_CHARS, 10) || 40,
  checkConcurrency: parseInt(process.env.CHECK_CONCURRENCY, 10) || 20,
  uploadsDir,
  screenshotsDir,

  // درایور ذخیره‌سازی اسکرین‌شات: 'local' (دیسک سرور) یا 'supabase' (برای هاست رایگان با دیسک غیردائمی)
  storageDriver: process.env.STORAGE_DRIVER || 'local',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseBucket: process.env.SUPABASE_BUCKET || 'screenshots',

  // فعال/غیرفعال بودن زمان‌بند داخلی node-cron (روی هاست رایگانی که می‌خوابد، بهتر است خاموش باشد
  // و به‌جایش از /api/cron/run-check با یک سرویس cron خارجی رایگان استفاده کنید)
enableInternalScheduler: process.env.ENABLE_INTERNAL_SCHEDULER !== 'false',
  cronSecret: process.env.CRON_SECRET || '',

  // خلاصه‌سازی تغییرات با هوش‌مصنوعی (Mistral AI). اگر MISTRAL_API_KEY خالی باشد،
  // این ویژگی به‌طور خودکار غیرفعال می‌ماند (بدون کرش کردن سیستم).
  mistralApiKey: process.env.MISTRAL_API_KEY || '',
  mistralModel: process.env.MISTRAL_MODEL || 'mistral-small-latest',
};
