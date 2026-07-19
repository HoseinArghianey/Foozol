const pool = require('../db/pool');
const { timeAgoFa } = require('../utils/timeAgo');
const { ApiError } = require('../middleware/errorHandler');

function serialize(row) {
  return {
    id: row.id,
    linkId: row.link_id,
    message: row.message,
    isRead: row.is_read,
    time: timeAgoFa(row.created_at),
    createdAt: row.created_at,
    linkTitle: row.link_title || null,
  };
}

async function listNotifications(req, res) {
  const { rows } = await pool.query(
    `SELECT notifications.*, links.title AS link_title
     FROM notifications
     LEFT JOIN links ON links.id = notifications.link_id
     ORDER BY notifications.created_at DESC
     LIMIT 100`
  );
  res.json(rows.map(serialize));
}

async function markAsRead(req, res) {
  const { id } = req.params;
  const { rows } = await pool.query(
    'UPDATE notifications SET is_read = true WHERE id = $1 RETURNING *',
    [id]
  );
  if (!rows.length) throw new ApiError(404, 'اعلان پیدا نشد');
  res.json(serialize(rows[0]));
}

async function markAllAsRead(req, res) {
  await pool.query('UPDATE notifications SET is_read = true WHERE is_read = false');
  res.status(204).send();
}

module.exports = { listNotifications, markAsRead, markAllAsRead };
