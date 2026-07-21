-- اسکیمای پایگاه‌داده رصدلینک

CREATE TABLE IF NOT EXISTS links (
  id                       SERIAL PRIMARY KEY,
  url                      TEXT NOT NULL UNIQUE,
  title                    TEXT NOT NULL,
  category                 TEXT NOT NULL DEFAULT 'دسته‌بندی‌نشده',
  status                   TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),

  -- آخرین محتوای استخراج‌شده (برای مقایسه در بررسی بعدی) و هش آن برای تشخیص سریع تغییر
  content_text             TEXT,
  content_hash             TEXT,

  -- مسیر نسبیِ تنها اسکرین‌شاتِ فعلیِ ذخیره‌شده (uploads/<این مقدار>)؛ با هر تغییر جدید جایگزین و فایل قبلی حذف می‌شود
  current_screenshot_path  TEXT,

  last_checked_at          TIMESTAMPTZ,
  last_changed_at          TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_links_category ON links(category);
CREATE INDEX IF NOT EXISTS idx_links_status ON links(status);

-- لیست لینک‌ها و تصاویرِ شناخته‌شده از آخرین بررسی (برای تشخیص «لینک/تصویر جدید»
-- بدون نیاز به مرورگر — فقط با مقایسه‌ی این آرایه با نسخه‌ی جدیدِ استخراج‌شده)
ALTER TABLE links ADD COLUMN IF NOT EXISTS known_links  JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE links ADD COLUMN IF NOT EXISTS known_images JSONB NOT NULL DEFAULT '[]'::jsonb;

-- تاریخچه‌ی تغییرات محتوایی (فقط متادیتا؛ چون تصویر قبلی طبق سیاست پروژه حذف می‌شود)
CREATE TABLE IF NOT EXISTS change_logs (
  id               SERIAL PRIMARY KEY,
  link_id          INTEGER NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  detected_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_type      TEXT NOT NULL DEFAULT 'content', -- 'content' | 'new_link' | 'new_image'
  added_preview    TEXT,          -- خلاصه‌ای از محتوای جدید اضافه‌شده (یا آدرس لینک/تصویر جدید)
  added_chars      INTEGER,       -- حجم محتوای جدید (کاراکتر) — برای change_type='content'
  screenshot_path  TEXT           -- مسیر اسکرین‌شات در لحظه‌ی ثبت (ممکن است بعداً با تغییر جدید حذف شده باشد)
);

ALTER TABLE change_logs ADD COLUMN IF NOT EXISTS change_type TEXT NOT NULL DEFAULT 'content';

CREATE INDEX IF NOT EXISTS idx_change_logs_link ON change_logs(link_id);
CREATE INDEX IF NOT EXISTS idx_change_logs_detected_at ON change_logs(detected_at DESC);

-- اعلان‌ها (زنگوله‌ی نوتیفیکیشن در فرانت)
CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  link_id     INTEGER REFERENCES links(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_link ON notifications(link_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(is_read) WHERE is_read = false;
