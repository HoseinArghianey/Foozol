const crypto = require('crypto');
const pool = require('../db/pool');
const config = require('../config');
const { fetchPageHtml, extractMainContent, extractLinksAndImages } = require('./scraperService');
const { findMeaningfulAdditions } = require('./diffService');
const { createNotification } = require('./notificationService');
const logger = require('../utils/logger');

function hashText(text) {
  return crypto.createHash('sha256').update(text || '').digest('hex');
}

// حداکثر تعداد لینک/تصویر جدیدی که در یک بررسی گزارش می‌شود (برای جلوگیری از
// سیل اعلان در اولین باری که یک لینک ثبت می‌شود یا صفحه کاملاً بازطراحی شده)
const MAX_REPORTED_NEW_ITEMS = 5;

/**
 * یک لینک را بررسی می‌کند: صفحه را با یک درخواست HTTP سبک (بدون مرورگر) می‌گیرد،
 * محتوای اصلی/لینک‌ها/تصاویر را استخراج می‌کند و با نسخه‌ی قبلی مقایسه می‌کند.
 * سه نوع تغییر مستقل تشخیص داده می‌شود:
 *   - content:   محتوای متنیِ معنادار جدید (نه تبلیغ/تعامل)
 *   - new_link:  صفحه/لینک داخلی جدیدی که قبلاً دیده نشده بود
 *   - new_image: تصویر/بنر جدیدی که قبلاً دیده نشده بود
 *
 * توجه: این تابع دیگر اسکرین‌شات نمی‌گیرد — اسکرین‌شات فقط با درخواست صریح
 * کاربر (endpoint جدا، با Puppeteer) گرفته می‌شود، تا مصرف منابع مستقل از
 * تعداد لینک‌ها بماند.
 *
 * @param {object} link - رکورد لینک از دیتابیس
 */
async function checkLink(link) {
  const {
    id,
    url,
    title,
    content_hash: prevHash,
    content_text: prevText,
    known_links: prevLinksRaw,
    known_images: prevImagesRaw,
  } = link;

  const prevLinks = new Set(Array.isArray(prevLinksRaw) ? prevLinksRaw : []);
  const prevImages = new Set(Array.isArray(prevImagesRaw) ? prevImagesRaw : []);
  const isFirstCheck = prevLinks.size === 0 && prevImages.size === 0 && !prevHash;

  try {
    const html = await fetchPageHtml(url, config.scrapeTimeoutMs);
    const newText = extractMainContent(html, url);
    const { links: newLinksArr, images: newImagesArr } = extractLinksAndImages(html, url);
    const newHash = hashText(newText);

    if (!newText && newLinksArr.length === 0) {
      await pool.query('UPDATE links SET last_checked_at = now() WHERE id = $1', [id]);
      logger.warn(`محتوایی از صفحه استخراج نشد (احتمالاً بلاک یا خالی): ${url}`);
      return { changed: false, warning: 'empty_content' };
    }

    // --- تشخیص لینک/تصویر جدید (مستقل از diff متنی) ---
    const newlyAddedLinks = isFirstCheck ? [] : newLinksArr.filter((l) => !prevLinks.has(l));
    const newlyAddedImages = isFirstCheck ? [] : newImagesArr.filter((im) => !prevImages.has(im));

    // --- تشخیص تغییر محتوای متنی معنادار (نه نویز تبلیغاتی) ---
    let isMeaningfulContent = false;
    let contentPreview = '';
    let totalChars = 0;
    if (newHash !== prevHash) {
      const result = findMeaningfulAdditions(prevText, newText, config.minAddedChars);
      isMeaningfulContent = result.isMeaningful;
      totalChars = result.totalChars;
      contentPreview = result.meaningful.slice(0, 3).join(' … ').slice(0, 500);
    }

    const hasNewLinks = newlyAddedLinks.length > 0;
    const hasNewImages = newlyAddedImages.length > 0;
    const anyChange = isMeaningfulContent || hasNewLinks || hasNewImages;

    // baseline همیشه به‌روزرسانی می‌شود (چه تغییر معنادار بود چه نبود)، تا در
    // بررسی بعدی همین وضعیت به‌عنوان نقطه‌ی مرجع جدید در نظر گرفته شود
    await pool.query(
      `UPDATE links
       SET content_hash = $1,
           content_text = $2,
           known_links = $3,
           known_images = $4,
           last_checked_at = now(),
           last_changed_at = CASE WHEN $5 THEN now() ELSE last_changed_at END
       WHERE id = $6`,
      [newHash, newText, JSON.stringify(newLinksArr), JSON.stringify(newImagesArr), anyChange, id]
    );

    if (!anyChange) {
      logger.info(`بدون تغییر معنادار: ${url}`);
      return { changed: false };
    }

    const changeEntries = [];

    if (isMeaningfulContent) {
      changeEntries.push({ type: 'content', preview: contentPreview, chars: totalChars });
    }
    if (hasNewLinks) {
      const shown = newlyAddedLinks.slice(0, MAX_REPORTED_NEW_ITEMS);
      changeEntries.push({
        type: 'new_link',
        preview: shown.join('، '),
        chars: newlyAddedLinks.length,
      });
    }
    if (hasNewImages) {
      const shown = newlyAddedImages.slice(0, MAX_REPORTED_NEW_ITEMS);
      changeEntries.push({
        type: 'new_image',
        preview: shown.join('، '),
        chars: newlyAddedImages.length,
      });
    }

    for (const entry of changeEntries) {
      await pool.query(
        `INSERT INTO change_logs (link_id, change_type, added_preview, added_chars)
         VALUES ($1, $2, $3, $4)`,
        [id, entry.type, entry.preview, entry.chars]
      );
    }

    const messages = {
      content: `محتوای جدید در «${title}» شناسایی شد`,
      new_link: `صفحه/لینک جدید در «${title}» شناسایی شد`,
      new_image: `تصویر/بنر جدید در «${title}» شناسایی شد`,
    };
    for (const entry of changeEntries) {
      await createNotification(id, messages[entry.type]);
    }

    logger.info(
      `✓ تغییر شناسایی شد: ${url} (${changeEntries.map((e) => e.type).join(', ')})`
    );
    return { changed: true, types: changeEntries.map((e) => e.type) };
  } catch (err) {
    logger.error(`خطا در بررسی ${url}: ${err.message}`);
    await pool
      .query('UPDATE links SET last_checked_at = now() WHERE id = $1', [id])
      .catch(() => {});
    return { changed: false, error: err.message };
  }
}

module.exports = { checkLink, hashText };
