const config = require('../config');
const { ApiError } = require('../middleware/errorHandler');
const { runCheckCycle } = require('../services/schedulerService');
const logger = require('../utils/logger');

/**
 * این endpoint برای سرویس‌های cron خارجی و رایگان (مثل cron-job.org) طراحی شده است؛
 * روی هاست‌های رایگانی که پروسه بعد از بی‌فعالیتی می‌خوابد (Render Free و مشابه)،
 * زمان‌بند داخلی node-cron ممکن است اجرا نشود چون پروسه خوابیده. با فراخوانی این
 * مسیر هر ۱۲ دقیقه از یک سرویس cron خارجی، سرور بیدار می‌شود و چرخه‌ی بررسی اجرا می‌شود.
 *
 * برای امنیت، باید هدر X-Cron-Secret برابر مقدار CRON_SECRET در .env ارسال شود.
 */
async function triggerCheckCycle(req, res) {
  if (!config.cronSecret) {
    throw new ApiError(500, 'CRON_SECRET تنظیم نشده است؛ این مسیر غیرفعال است.');
  }
  const provided = req.header('X-Cron-Secret');
  if (provided !== config.cronSecret) {
    throw new ApiError(401, 'دسترسی غیرمجاز');
  }

  // پاسخ را فوراً برمی‌گردانیم تا سرویس cron خارجی timeout نشود؛ چرخه در پس‌زمینه اجرا می‌شود
  res.json({ status: 'started', startedAt: new Date().toISOString() });

  runCheckCycle().catch((err) => {
    logger.error('خطا در اجرای چرخه بررسی (از طریق cron خارجی):', err.message);
  });
}

module.exports = { triggerCheckCycle };
