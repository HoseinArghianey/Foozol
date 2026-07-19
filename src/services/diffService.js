const { diffArrays } = require('diff');
const { isNoiseLine } = require('./contentFilter');

const MIN_PARAGRAPH_LEN = 15; // پاراگراف‌های خیلی کوتاه معمولاً چروک رابط کاربری‌اند، نه محتوا

function splitParagraphs(text) {
  return (text || '')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * محتوای «واقعاً جدید» بین متن قدیم و جدید صفحه را پیدا می‌کند.
 * فقط پاراگراف‌هایی که در نسخه‌ی جدید اضافه شده‌اند در نظر گرفته می‌شوند
 * (نه پاراگراف‌هایی که فقط جابه‌جا شده‌اند)، سپس نویزهای تبلیغاتی/تعاملی حذف می‌شوند.
 */
function findMeaningfulAdditions(oldText, newText, minChars = 40) {
  const oldParas = splitParagraphs(oldText);
  const newParas = splitParagraphs(newText);

  const diffResult = diffArrays(oldParas, newParas);

  const addedParas = [];
  diffResult.forEach((part) => {
    if (part.added) addedParas.push(...part.value);
  });

  const meaningful = addedParas.filter(
    (p) => p.length >= MIN_PARAGRAPH_LEN && !isNoiseLine(p)
  );

  const totalChars = meaningful.reduce((sum, p) => sum + p.length, 0);

  return {
    meaningful,
    totalChars,
    isMeaningful: totalChars >= minChars,
  };
}

module.exports = { findMeaningfulAdditions, splitParagraphs };
