const cron = require('node-cron');
const puppeteer = require('puppeteer');
const pLimit = require('p-limit');
const pool = require('../db/pool');
const config = require('../config');
const { checkLink } = require('./linkService');
const logger = require('../utils/logger');

let isRunning = false;

/**
 * تمام لینک‌های فعال را بررسی می‌کند. یک مرورگر مشترک برای کل چرخه باز نگه داشته
 * می‌شود (برای کارایی بهتر) و همزمانی با p-limit محدود می‌شود تا فشار زیادی
 * به CPU/RAM سرور وارد نشود.
 */
async function runCheckCycle() {
  if (isRunning) {
    logger.warn('چرخه بررسی قبلی هنوز در حال اجراست؛ این اجرا رد شد.');
    return;
  }
  isRunning = true;
  const startedAt = Date.now();

  try {
    const { rows: links } = await pool.query(`SELECT * FROM links WHERE status = 'active'`);

    if (!links.length) {
      logger.info('هیچ لینک فعالی برای بررسی وجود ندارد.');
      return;
    }

    logger.info(`شروع چرخه بررسی برای ${links.length} لینک...`);

    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // در کانتینرهای کم‌حافظه (مثل هاست رایگان)، /dev/shm کوچک است و بدون این فلگ کروم کرش می‌کند
        '--disable-gpu',
      ],
    });

    const limit = pLimit(config.checkConcurrency);
    const results = await Promise.all(
      links.map((link) => limit(() => checkLink(browser, link)))
    );

    await browser.close();

    const changedCount = results.filter((r) => r.changed).length;
    const errorCount = results.filter((r) => r.error).length;
    const durationSec = ((Date.now() - startedAt) / 1000).toFixed(1);

    logger.info(
      `پایان چرخه بررسی در ${durationSec} ثانیه — ${changedCount} تغییر محتوایی، ${errorCount} خطا از ${links.length} لینک.`
    );
  } catch (err) {
    logger.error('خطا در اجرای چرخه بررسی:', err.message);
  } finally {
    isRunning = false;
  }
}

function startScheduler() {
  if (!cron.validate(config.checkCron)) {
    logger.error(`الگوی cron نامعتبر است: ${config.checkCron} — زمان‌بند فعال نشد.`);
    return;
  }
  cron.schedule(config.checkCron, () => {
    runCheckCycle().catch((err) => logger.error('خطای مدیریت‌نشده در زمان‌بند:', err.message));
  });
  logger.info(`زمان‌بند فعال شد (الگوی cron: "${config.checkCron}")`);
}

module.exports = { startScheduler, runCheckCycle };
