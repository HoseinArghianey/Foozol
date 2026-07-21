const config = require('../config');
const logger = require('../utils/logger');

// از Mistral AI (شرکت اروپایی) به‌جای Anthropic استفاده می‌کنیم — چون API
// تجاری Anthropic برای ایران در دسترس نیست. فرمت درخواست/پاسخ Mistral شبیه
// OpenAI Chat Completions است.
const API_URL = 'https://api.mistral.ai/v1/chat/completions';

/**
 * یک فراخوانی به Mistral API (مدل small، ارزان‌ترین گزینه‌ی مناسب) برای
 * خلاصه‌سازی تغییرات یک لینک. همه‌ی نوع تغییرها (محتوا + لینک جدید + تصویر
 * جدید) در یک درخواست ترکیب می‌شوند تا هزینه به تعداد لینک‌های واقعاً
 * تغییریافته محدود بماند، نه به تعداد کل آیتم‌های تغییریافته.
 *
 * @returns {Promise<{contentSummary: string|null, contentIsPromotional: boolean, items: Array<{url: string, summary: string, isPromotional: boolean}>}|null>}
 *          در صورت نبود کلید API یا خطا، null برمی‌گرداند (ویژگی به‌صورت خاموش غیرفعال می‌شود، بدون کرش کردن سیستم)
 */
async function summarizeLinkChange({
  linkTitle,
  url,
  contentChanged,
  before,
  after,
  newLinks = [],
  newImages = [],
  linkContext = {},
  imageContext = {},
}) {
  if (!config.mistralApiKey) return null;

  const linkItemsText = newLinks
    .map((u) => `- [لینک] ${u}\n  متن اطراف: "${(linkContext[u] || '').slice(0, 150)}"`)
    .join('\n');
  const imageItemsText = newImages
    .map((u) => `- [تصویر] ${u}\n  متن جایگزین (alt): "${(imageContext[u] || '').slice(0, 150)}"`)
    .join('\n');

  const contentSection = contentChanged
    ? `متن قبلیِ صفحه (خلاصه):\n"""${(before || '').slice(0, 1200)}"""\n\nمتن جدیدِ صفحه (خلاصه):\n"""${(after || '').slice(0, 1200)}"""`
    : '(بدون تغییر محتوای متنی)';

  const prompt = `شما دستیار رصد تغییرات وب‌سایت هستید. عنوان سایت رصدشده: «${linkTitle}» (${url}).

${contentSection}

آیتم‌های جدیدِ شناسایی‌شده (لینک/تصویر که قبلاً روی صفحه نبودند):
${linkItemsText || imageItemsText ? `${linkItemsText}\n${imageItemsText}`.trim() : '(هیچ‌کدام)'}

فقط یک شیء JSON با این فرمت دقیق برگردان، بدون هیچ متن اضافه یا Markdown:
{
  "contentSummary": ${contentChanged ? '"توضیح کوتاه فارسی (حداکثر ۲۵ کلمه) از مهم‌ترین تغییر محتوایی"' : 'null'},
  "contentIsPromotional": ${contentChanged ? 'true/false — آیا تغییر محتوا صرفاً تبلیغاتی/نامرتبط با موضوع اصلی سایت است' : 'false'},
  "items": [
    ${linkItemsText || imageItemsText ? '{"url": "همان آدرس آیتم", "summary": "توضیح کوتاه فارسی (حداکثر ۱۵ کلمه) که این آیتم احتمالاً چیست", "isPromotional": true/false}' : ''}
  ]
}
مقدار isPromotional را true بگذار اگر آن مورد به‌نظر تبلیغ/بنر/محتوای نامرتبط با موضوع اصلی سایت است (نه یک صفحه/محصول/مقاله‌ی واقعی).`;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${config.mistralApiKey}`,
      },
      body: JSON.stringify({
        model: config.mistralModel,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 500,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error(`خطای Mistral API (${res.status}): ${errText.slice(0, 300)}`);
      return null;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return {
      contentSummary: parsed.contentSummary || null,
      contentIsPromotional: Boolean(parsed.contentIsPromotional),
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch (err) {
    logger.error(`خطا در فراخوانی سرویس خلاصه‌سازی هوش‌مصنوعی: ${err.message}`);
    return null;
  }
}

module.exports = { summarizeLinkChange };
