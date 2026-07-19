const { Pool } = require('pg');
const config = require('../config');

// سرویس‌های PostgreSQL مدیریت‌شده مثل Supabase اتصال بدون SSL را قبول نمی‌کنند؛
// اگر SSL درخواست نشود، اتصال به‌جای خطای واضح، بی‌نهایت معطل می‌ماند (hang).
const requiresSsl = /supabase\.(co|com)/i.test(config.databaseUrl);

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 10000, // اگر اتصال ۱۰ ثانیه طول کشید، به‌جای hang ابدی، خطای صریح بده
});

pool.on('error', (err) => {
  // اتصال‌های idle که خطا می‌دهند نباید کل پروسه را کرش کنند
  console.error('خطای غیرمنتظره در PostgreSQL pool:', err.message);
});

module.exports = pool;
