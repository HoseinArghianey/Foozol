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

-- تاریخچه‌ی تغییرات محتوایی (فقط متادیتا؛ چون تصویر قبلی طبق سیاست پروژه حذف می‌شود)
CREATE TABLE IF NOT EXISTS change_logs (
  id               SERIAL PRIMARY KEY,
  link_id          INTEGER NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  detected_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  added_preview    TEXT,          -- خلاصه‌ای از محتوای جدید اضافه‌شده
  added_chars      INTEGER,       -- حجم محتوای جدید (کاراکتر)
  screenshot_path  TEXT           -- مسیر اسکرین‌شات در لحظه‌ی ثبت (ممکن است بعداً با تغییر جدید حذف شده باشد)
);

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
