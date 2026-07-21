const crypto = require('crypto');
const pool = require('../db/pool');
const config = require('../config');
const { fetchPageHtml, extractMainContent, extractLinksAndImages } = require('./scraperService');
const { findMeaningfulAdditions } = require('./diffService');
const { createNotification } = require('./notificationService');
const { summarizeLinkChange } = require('./aiSummaryService');
const logger = require('../utils/logger');

function hashText(text) {
  return crypto.createHash('sha256').update(text || '').digest('hex');
}

const MAX_REPORTED_NEW_ITEMS = 5;

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
    const {
      links: newLinksArr,
      images: newImagesArr,
      linkContext,
      imageContext,
    } = extractLinksAndImages(html, url);
    const newHash = hashText(newText);

    if (!newText && newLinksArr.length === 0) {
      await pool.query('UPDATE links SET last_checked_at = now() WHERE id = $1', [id]);
      logger.warn(`محتوایی از صفحه استخراج نشد (احتمالاً بلاک یا خالی): ${url}`);
      return { changed: false, warning: 'empty_content' };
    }

    const newlyAddedLinks = isFirstCheck ? [] : newLinksArr.filter((l) => !prevLinks.has(l));
    const newlyAddedImages = isFirstCheck ? [] : newImagesArr.filter((im) => !prevImages.has(im));

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

    const shownLinks = newlyAddedLinks.slice(0, MAX_REPORTED_NEW_ITEMS);
    const shownImages = newlyAddedImages.slice(0, MAX_REPORTED_NEW_ITEMS);

    const aiResult = await summarizeLinkChange({
      linkTitle: title,
      url,
      contentChanged: isMeaningfulContent,
      before: prevText,
      after: newText,
      newLinks: shownLinks,
      newImages: shownImages,
      linkContext,
      imageContext,
    });
    const aiItemByUrl = new Map((aiResult?.items || []).map((it) => [it.url, it]));

    const changeEntries = [];

    if (isMeaningfulContent) {
      changeEntries.push({
        type: 'content',
        preview: contentPreview,
        chars: totalChars,
        aiSummary: aiResult?.contentSummary || null,
        isPromotional: Boolean(aiResult?.contentIsPromotional),
      });
    }
    shownLinks.forEach((itemUrl) => {
      const aiItem = aiItemByUrl.get(itemUrl);
      changeEntries.push({
        type: 'new_link',
        preview: itemUrl,
        chars: null,
        aiSummary: aiItem?.summary || null,
        isPromotional: Boolean(aiItem?.isPromotional),
      });
    });
    shownImages.forEach((itemUrl) => {
      const aiItem = aiItemByUrl.get(itemUrl);
      changeEntries.push({
        type: 'new_image',
        preview: itemUrl,
        chars: null,
        aiSummary: aiItem?.summary || null,
        isPromotional: Boolean(aiItem?.isPromotional),
      });
    });

    for (const entry of changeEntries) {
      await pool.query(
        `INSERT INTO change_logs (link_id, change_type, added_preview, added_chars, ai_summary, is_promotional)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, entry.type, entry.preview, entry.chars, entry.aiSummary, entry.isPromotional]
      );
    }

    const defaultMessages = {
      content: `محتوای جدید در «${title}» شناسایی شد`,
      new_link: `صفحه/لینک جدید در «${title}» شناسایی شد`,
      new_image: `تصویر/بنر جدید در «${title}» شناسایی شد`,
    };
    const typesSeen = new Set();
    for (const entry of changeEntries) {
      if (typesSeen.has(entry.type)) continue;
      typesSeen.add(entry.type);
      const message = entry.aiSummary || defaultMessages[entry.type];
      await createNotification(id, message);
    }

    logger.info(`✓ تغییر شناسایی شد: ${url} (${[...typesSeen].join(', ')})`);
    return { changed: true, types: [...typesSeen] };
  } catch (err) {
    logger.error(`خطا در بررسی ${url}: ${err.message}`);
    await pool
      .query('UPDATE links SET last_checked_at = now() WHERE id = $1', [id])
      .catch(() => {});
    return { changed: false, error: err.message };
  }
}

module.exports = { checkLink, hashText };
