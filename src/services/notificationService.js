const pool = require('../db/pool');

async function createNotification(linkId, message) {
  const { rows } = await pool.query(
    `INSERT INTO notifications (link_id, message) VALUES ($1, $2) RETURNING *`,
    [linkId, message]
  );
  return rows[0];
}

module.exports = { createNotification };
