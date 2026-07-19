const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

const useSupabase = config.storageDriver === 'supabase';

/**
 * بافر عکس را ذخیره می‌کند و مسیر نسبی آن (برای ذخیره در دیتابیس) را برمی‌گرداند.
 * - اگر STORAGE_DRIVER=supabase باشد: در Supabase Storage آپلود می‌شود (مناسب هاست رایگان
 *   با دیسک غیردائمی مثل Render Free).
 * - در غیر این صورت: روی دیسک محلی سرور ذخیره می‌شود (مناسب VPS/سرور با دیسک دائمی).
 */
async function saveScreenshot(buffer, linkId) {
  const filename = `link-${linkId}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;

  if (useSupabase) {
    const uploadUrl = `${config.supabaseUrl}/storage/v1/object/${config.supabaseBucket}/${filename}`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.supabaseServiceKey}`,
        'Content-Type': 'image/png',
        'x-upsert': 'true',
      },
      body: buffer,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`آپلود اسکرین‌شات در Supabase Storage ناموفق بود (${res.status}): ${text}`);
    }
    return { relativePath: filename };
  }

  await fs.mkdir(config.screenshotsDir, { recursive: true });
  const fullPath = path.join(config.screenshotsDir, filename);
  await fs.writeFile(fullPath, buffer);
  return { relativePath: `screenshots/${filename}` };
}

/**
 * اسکرین‌شات قبلی را حذف می‌کند (طبق سیاست پروژه: فقط آخرین عکس نگه داشته می‌شود).
 */
async function deleteScreenshot(relativePath) {
  if (!relativePath) return;

  if (useSupabase) {
    const deleteUrl = `${config.supabaseUrl}/storage/v1/object/${config.supabaseBucket}/${relativePath}`;
    try {
      const res = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${config.supabaseServiceKey}` },
      });
      if (!res.ok && res.status !== 404) {
        const text = await res.text().catch(() => '');
        logger.error(`خطا در حذف اسکرین‌شات قبلی از Supabase (${res.status}): ${text}`);
      } else {
        logger.info(`اسکرین‌شات قبلی حذف شد (Supabase): ${relativePath}`);
      }
    } catch (err) {
      logger.error('خطا در حذف اسکرین‌شات قبلی از Supabase:', err.message);
    }
    return;
  }

  const fullPath = path.join(config.uploadsDir, relativePath);
  try {
    await fs.unlink(fullPath);
    logger.info(`اسکرین‌شات قبلی حذف شد: ${relativePath}`);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.error(`خطا در حذف اسکرین‌شات قبلی (${relativePath}):`, err.message);
    }
  }
}

/**
 * از مسیر نسبیِ ذخیره‌شده در دیتابیس، URL عمومیِ قابل‌نمایش در فرانت را می‌سازد.
 */
function screenshotPublicUrl(relativePath) {
  if (!relativePath) return null;
  if (useSupabase) {
    return `${config.supabaseUrl}/storage/v1/object/public/${config.supabaseBucket}/${relativePath}`;
  }
  return `${config.publicBaseUrl}/uploads/${relativePath}`;
}

module.exports = { saveScreenshot, deleteScreenshot, screenshotPublicUrl };
