const pool = require('../db/pool');
const { timeAgoFa } = require('../utils/timeAgo');

async function listAllHistory(req, res) {
  const { rows } = await pool.query(
    `SELECT change_logs.*, links.title AS link_title, links.category AS link_category, links.url AS link_url
     FROM change_logs
     JOIN links ON links.id = change_logs.link_id
     ORDER BY change_logs.detected_at DESC
     LIMIT 100`
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      linkId: r.link_id,
      linkTitle: r.link_title,
      category: r.link_category,
      detectedAt: r.detected_at,
      time: timeAgoFa(r.detected_at),
      changeType: r.change_type,
      addedPreview: r.added_preview,
      addedChars: r.added_chars,
      aiSummary: r.ai_summary,
      isPromotional: r.is_promotional,
      // آدرس خودِ صفحه‌ی رصدشده — برای «تصویر جدید» باید کاربر به همین صفحه
      // برود، نه به آدرس خامِ فایل عکس
      linkUrl: r.link_url,
    }))
  );
}

module.exports = { listAllHistory };
