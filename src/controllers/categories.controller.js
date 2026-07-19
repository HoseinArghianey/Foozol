const pool = require('../db/pool');

async function listCategories(req, res) {
  const { rows } = await pool.query(
    `SELECT category AS name, COUNT(*)::int AS count
     FROM links
     GROUP BY category
     ORDER BY count DESC, name ASC`
  );
  res.json(rows);
}

module.exports = { listCategories };
