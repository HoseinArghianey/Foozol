const crypto = require('crypto');
const pool = require('../db/pool');
const config = require('../config');
const { fetchPageData, extractMainContent } = require('./scraperService');
const { findMeaningfulAdditions } = require('./diffService');
const { saveScreenshot, deleteScreenshot } = require('./screenshotService');
const { createNotification } = require('./notificationService');
const logger = require('../utils/logger');

function hashText(text) {
  return crypto.createHash('sha256').update(text || '').digest('hex');
}

/**
 * یک لینک را بررسی می‌کند: صفحه را می‌گیرد، محتوای اصلی را استخراج می‌کند،
 * با نسخه‌ی قبلی مقایسه می‌کند و فقط در صورت وجود محتوای واقعاً جدید
 * (نه تبلیغات/تعاملات) عکس می‌گیرد، عکس قبلی را حذف و اعلان ثبت می‌کند.
 *
 * @param {import('puppeteer').Browser} browser
 * @param {object} link - رکورد لینک از دیتابیس
 */
async function checkLink(browser, link) {
  const { id, url, title, content_hash: prevHash, content_text: prevText, current_screenshot_path: prevScreenshot } = link;

  try {
    const { html, screenshotBuffer } = await fetchPageData(browser, url, config.scrapeTimeoutMs);
    const newText = extractMainContent(html, url);
    const newHash = hashText(newText);

    // اگر محتوا اصلاً استخراج نشد (صفحه خالی/بلاک‌شده)، فقط زمان بررسی را ثبت کن و خارج شو
    if (!newText) {
      await pool.query('UPDATE links SET last_checked_at = now() WHERE id = $1', [id]);
      logger.warn(`محتوایی از صفحه استخراج نشد (احتمالاً بلاک یا خالی): ${url}`);
      return { changed: false, warning: 'empty_content' };
    }

    if (newHash === prevHash) {
      await pool.query('UPDATE links SET last_checked_at = now() WHERE id = $1', [id]);
      logger.info(`بدون تغییر: ${url}`);
      return { changed: false };
    }

    // چیزی در صفحه عوض شده؛ حالا باید بفهمیم آیا این تغییر «محتوای واقعی» است یا فقط
    // تبلیغات/شمارنده‌های تعاملی/بازآرایی که نباید اعلام شود.
    const { meaningful, totalChars, isMeaningful } = findMeaningfulAdditions(
      prevText,
      newText,
      config.minAddedChars
    );

    if (!isMeaningful) {
      // baseline را به‌روزرسانی می‌کنیم تا در بررسی بعدی دوباره همین نویز، «تغییر» تشخیص داده نشود،
      // ولی هیچ عکسی گرفته نمی‌شود و اعلانی هم ثبت نمی‌شود.
      await pool.query(
        `UPDATE links SET content_hash = $1, content_text = $2, last_checked_at = now() WHERE id = $3`,
        [newHash, newText, id]
      );
      logger.info(`تغییر غیرمحتوایی (تبلیغ/تعامل) نادیده گرفته شد: ${url}`);
      return { changed: false, ignoredNoise: true };
    }

    // --- تغییر محتوایی واقعی تشخیص داده شد ---
    const { relativePath } = await saveScreenshot(screenshotBuffer, id);

    // عکس قبلی طبق سیاست پروژه حذف می‌شود
    if (prevScreenshot) {
      await deleteScreenshot(prevScreenshot);
    }

    const preview = meaningful.slice(0, 3).join(' … ').slice(0, 500);

    await pool.query(
      `UPDATE links
       SET content_hash = $1,
           content_text = $2,
           current_screenshot_path = $3,
           last_checked_at = now(),
           last_changed_at = now()
       WHERE id = $4`,
      [newHash, newText, relativePath, id]
    );

    await pool.query(
      `INSERT INTO change_logs (link_id, added_preview, added_chars, screenshot_path)
       VALUES ($1, $2, $3, $4)`,
      [id, preview, totalChars, relativePath]
    );

    await createNotification(id, `محتوای جدید در «${title}» شناسایی شد`);

    logger.info(`✓ تغییر محتوایی شناسایی شد: ${url} (${totalChars} کاراکتر جدید)`);
    return { changed: true, preview, totalChars };
  } catch (err) {
    logger.error(`خطا در بررسی ${url}: ${err.message}`);
    await pool
      .query('UPDATE links SET last_checked_at = now() WHERE id = $1', [id])
      .catch(() => {});
    return { changed: false, error: err.message };
  }
}

module.exports = { checkLink, hashText };
