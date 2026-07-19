// اجرای یک‌بارِ چرخه‌ی بررسیِ همه‌ی لینک‌ها، بدون نیاز به منتظر ماندن برای cron.
// استفاده: npm run check-now
const pool = require('../db/pool');
const { runCheckCycle } = require('../services/schedulerService');

runCheckCycle()
  .then(() => pool.end())
  .catch((err) => {
    console.error('خطا در اجرای چرخه بررسی:', err);
    process.exit(1);
  });
