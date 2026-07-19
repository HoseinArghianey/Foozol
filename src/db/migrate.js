const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  console.log('در حال اجرای مایگریشن دیتابیس...');
  await pool.query(sql);
  console.log('مایگریشن با موفقیت انجام شد.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('خطا در اجرای مایگریشن:', err);
  process.exit(1);
});
