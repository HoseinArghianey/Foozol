/**
 * تبدیل یک تاریخ به عبارت نسبیِ فارسی، مطابق چیزی که فرانت‌اند انتظار دارد
 * (مثل «۱۲ دقیقه پیش»، «۲ ساعت پیش»، «۱ روز پیش»)
 */
function timeAgoFa(date) {
  if (!date) return 'هنوز بررسی نشده';

  const diffMs = Date.now() - new Date(date).getTime();
  if (diffMs < 0) return 'همین الان';

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'همین الان';
  if (minutes < 60) return `${minutes} دقیقه پیش`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ساعت پیش`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} روز پیش`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ماه پیش`;

  const years = Math.floor(months / 12);
  return `${years} سال پیش`;
}

module.exports = { timeAgoFa };
