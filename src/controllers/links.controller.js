const pool = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const { timeAgoFa } = require('../utils/timeAgo');
const { deleteScreenshot, saveScreenshot, screenshotPublicUrl } = require('../services/screenshotService');
const { checkLink } = require('../services/linkService');
const { launchBrowser } = require('../services/browserLauncher');
const config = require('../config');
const logger = require('../utils/logger');

function normalizeUrl(rawUrl) {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    return u.toString();
  } catch (err) {
    return null;
  }
}

function toDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (err) {
    return url;
  }
}

// وقتی خلاصه‌ی هوش‌مصنوعی موجود نباشد (کلید Mistral تنظیم نشده یا خطا داده)،
// به‌جای نمایش مستقیمِ آدرس خام لینک/تصویر (که هم زشت است هم چون یک رشته‌ی
// طولانیِ بدون فاصله است می‌تواند چیدمان گرید را بشکند)، یک پیام خوانا نشان می‌دهیم.
function friendlyChangeFallback(changeType, preview) {
  if (changeType === 'new_link') return 'یک صفحه/لینک جدید شناسایی شد';
  if (changeType === 'new_image') return 'یک تصویر/بنر جدید شناسایی شد';
  return preview || null; // برای نوع «content» خودِ preview متن خوانایی است
}

// شکل خروجی دقیقاً منطبق با چیزی است که فرانت‌اند فعلی (آرایه‌ی links) انتظار دارد
// + چند فیلد اضافه‌ی مفید (id، url کامل، آدرس اسکرین‌شات) برای تعامل کامل با بک‌اند.
function serialize(row) {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    domain: toDomain(row.url),
    cat: row.category,
    status: row.status,
    time: timeAgoFa(row.last_checked_at),
    changed: Number(row.unread_count) > 0,
    // اسکرین‌شات دیگر خودکار گرفته نمی‌شود؛ اگر تا الان درخواست نشده باشد null است
    // و فرانت باید دکمه‌ی «درخواست اسکرین‌شات» نشان دهد (endpoint زیر را صدا بزند)
    screenshotUrl: screenshotPublicUrl(row.current_screenshot_path),
    lastCheckedAt: row.last_checked_at,
    lastChangedAt: row.last_changed_at,
    createdAt: row.created_at,
    // آخرین تغییرِ ثبت‌شده (برای نمایش مستقیم روی کارت، بدون نیاز به درخواست جدا)
    latestChangeType: row.latest_change_type || null,
    latestSummary: row.latest_ai_summary || friendlyChangeFallback(row.latest_change_type, row.latest_added_preview),
    latestIsPromotional: Boolean(row.latest_is_promotional),
    latestChangeAt: row.latest_detected_at || null,
  };
}

const LIST_QUERY = `
  SELECT links.*,
    (SELECT COUNT(*) FROM notifications n WHERE n.link_id = links.id AND n.is_read = false) AS unread_count,
    latest.change_type    AS latest_change_type,
    latest.ai_summary     AS latest_ai_summary,
    latest.added_preview  AS latest_added_preview,
    latest.is_promotional AS latest_is_promotional,
    latest.detected_at    AS latest_detected_at
  FROM links
  LEFT JOIN LATERAL (
    SELECT change_type, ai_summary, added_preview, is_promotional, detected_at
    FROM change_logs
    WHERE change_logs.link_id = links.id
    ORDER BY detected_at DESC
    LIMIT 1
  ) latest ON true
`;

async function listLinks(req, res) {
  const { category } = req.query;
  let query = LIST_QUERY;
  const params = [];
  if (category) {
    params.push(category);
    query += ` WHERE links.category = $${params.length}`;
  }
  query += ' ORDER BY links.created_at DESC';

  const { rows } = await pool.query(query, params);
  res.json(rows.map(serialize));
}

async function getLink(req, res) {
  const { rows } = await pool.query(`${LIST_QUERY} WHERE links.id = $1`, [req.params.id]);
  if (!rows.length) throw new ApiError(404, 'لینک پیدا نشد');
  res.json(serialize(rows[0]));
}

async function createLink(req, res) {
  const { url: rawUrl, title, cat, category } = req.body;
  const normalizedUrl = normalizeUrl(rawUrl);
  if (!normalizedUrl) throw new ApiError(400, 'آدرس لینک نامعتبر است');
  if (!title || !title.trim()) throw new ApiError(400, 'عنوان الزامی است');

  const finalCategory = (category || cat || '').trim() || 'دسته‌بندی‌نشده';

  try {
    const { rows } = await pool.query(
      `INSERT INTO links (url, title, category) VALUES ($1, $2, $3) RETURNING *`,
      [normalizedUrl, title.trim(), finalCategory]
    );
    res.status(201).json(serialize({ ...rows[0], unread_count: 0 }));
  } catch (err) {
    if (err.code === '23505') {
      // نقض قید UNIQUE روی url
      throw new ApiError(409, 'این لینک قبلاً ثبت شده است');
    }
    throw err;
  }
}

async function updateLink(req, res) {
  const { id } = req.params;
  const { title, category, cat, status } = req.body;

  const { rows: existingRows } = await pool.query('SELECT * FROM links WHERE id = $1', [id]);
  if (!existingRows.length) throw new ApiError(404, 'لینک پیدا نشد');

  if (status && !['active', 'paused'].includes(status)) {
    throw new ApiError(400, 'وضعیت نامعتبر است');
  }

  const { rows } = await pool.query(
    `UPDATE links SET
       title = COALESCE($1, title),
       category = COALESCE($2, category),
       status = COALESCE($3, status)
     WHERE id = $4
     RETURNING *`,
    [title ?? null, (category ?? cat) ?? null, status ?? null, id]
  );
  res.json(serialize({ ...rows[0], unread_count: 0 }));
}

async function deleteLink(req, res) {
  const { id } = req.params;
  const { rows } = await pool.query('SELECT * FROM links WHERE id = $1', [id]);
  if (!rows.length) throw new ApiError(404, 'لینک پیدا نشد');

  if (rows[0].current_screenshot_path) {
    await deleteScreenshot(rows[0].current_screenshot_path);
  }
  await pool.query('DELETE FROM links WHERE id = $1', [id]);
  res.status(204).send();
}

// بررسی فوری و دستیِ یک لینک (بدون نیاز به منتظر ماندن برای چرخه‌ی زمان‌بندی‌شده)
// این هم مثل چرخه‌ی خودکار، سبک و بدون مرورگر است.
async function checkLinkNow(req, res) {
  const { id } = req.params;
  const { rows } = await pool.query('SELECT * FROM links WHERE id = $1', [id]);
  if (!rows.length) throw new ApiError(404, 'لینک پیدا نشد');

  const result = await checkLink(rows[0]);

  const { rows: updated } = await pool.query(`${LIST_QUERY} WHERE links.id = $1`, [id]);
  res.json({ result, link: serialize(updated[0]) });
}

// اسکرین‌شات درخواستیِ کاربر (on-demand): تنها جایی که Puppeteer صدا زده می‌شود.
// چون فقط با کلیک واقعی کاربر اجرا می‌شود (نه برای هر لینک در هر چرخه)، مصرف
// منابع مستقل از تعداد کل لینک‌های سیستم می‌ماند.
async function requestScreenshot(req, res) {
  const { id } = req.params;
  const { rows } = await pool.query('SELECT * FROM links WHERE id = $1', [id]);
  if (!rows.length) throw new ApiError(404, 'لینک پیدا نشد');

  const link = rows[0];
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await page.goto(link.url, { waitUntil: 'networkidle2', timeout: config.scrapeTimeoutMs });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const buffer = await page.screenshot({ fullPage: true, type: 'png' });
    await page.close();

    const { relativePath } = await saveScreenshot(buffer, id);
    if (link.current_screenshot_path) {
      await deleteScreenshot(link.current_screenshot_path);
    }
    await pool.query('UPDATE links SET current_screenshot_path = $1 WHERE id = $2', [
      relativePath,
      id,
    ]);

    res.json({ screenshotUrl: screenshotPublicUrl(relativePath) });
  } catch (err) {
    logger.error(`خطا در گرفتن اسکرین‌شات درخواستی برای لینک ${id}: ${err.message}`);
    throw new ApiError(502, 'گرفتن اسکرین‌شات ناموفق بود؛ ممکن است سایت در دسترس نباشد.');
  } finally {
    if (browser) await browser.close();
  }
}

// تاریخچه‌ی تغییرات یک لینک خاص
async function getLinkHistory(req, res) {
  const { id } = req.params;
  const { rows } = await pool.query(
    `SELECT * FROM change_logs WHERE link_id = $1 ORDER BY detected_at DESC LIMIT 100`,
    [id]
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      detectedAt: r.detected_at,
      time: timeAgoFa(r.detected_at),
      changeType: r.change_type,
      addedPreview: r.added_preview,
      addedChars: r.added_chars,
      aiSummary: r.ai_summary,
      isPromotional: r.is_promotional,
    }))
  );
}

// علامت‌گذاری اعلان‌های یک لینک به‌عنوان دیده‌شده (خاموش کردن بج «تغییر جدید»)
async function dismissLinkChanges(req, res) {
  const { id } = req.params;
  await pool.query('UPDATE notifications SET is_read = true WHERE link_id = $1', [id]);
  const { rows } = await pool.query(`${LIST_QUERY} WHERE links.id = $1`, [id]);
  if (!rows.length) throw new ApiError(404, 'لینک پیدا نشد');
  res.json(serialize(rows[0]));
}

module.exports = {
  listLinks,
  getLink,
  createLink,
  updateLink,
  deleteLink,
  checkLinkNow,
  requestScreenshot,
  getLinkHistory,
  dismissLinkChanges,
};
