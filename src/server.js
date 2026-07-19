const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const config = require('./config');
const logger = require('./utils/logger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { startScheduler } = require('./services/schedulerService');

const linksRoutes = require('./routes/links.routes');
const categoriesRoutes = require('./routes/categories.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const historyRoutes = require('./routes/history.routes');
const cronRoutes = require('./routes/cron.routes');

const app = express();

app.use(
  helmet({
    // اسکرین‌شات‌ها باید از origin دیگری (فرانت) هم قابل بارگذاری در <img> باشند
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
  })
);
app.use(express.json());
app.use(morgan('tiny'));

// سرو استاتیک اسکرین‌شات‌ها: /uploads/screenshots/xxx.png
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/links', linksRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/cron', cronRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  logger.info(`سرور رصدلینک روی پورت ${config.port} اجرا شد`);
  if (config.enableInternalScheduler) {
    startScheduler();
  } else {
    logger.info('زمان‌بند داخلی غیرفعال است (ENABLE_INTERNAL_SCHEDULER=false) — از /api/cron/run-check با یک سرویس cron خارجی استفاده کنید.');
  }
});
