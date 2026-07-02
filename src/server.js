const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');

const config = require('./config');
const logger = require('./utils/logger');
const { testConnection } = require('./db/pool');
const { initDatabase } = require('./db/init');
const { startCron } = require('./jobs/cron');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const dashboardRouter = require('./routes/dashboard');
const platformsRouter = require('./routes/platforms');
const recordsRouter = require('./routes/records');
const collectRouter = require('./routes/collect');
const alertsRouter = require('./routes/alerts');
const settingsRouter = require('./routes/settings');
const recipientsRouter = require('./routes/recipients');
const healthRouter = require('./routes/health');

async function start() {
  try {
    await initDatabase();
  } catch (e) {
    logger.error('数据库初始化失败:', e.message);
  }

  const dbOk = await testConnection();
  if (!dbOk) {
    logger.warn('MySQL 连接失败，系统以降级模式启动（采集/告警暂不可用）');
  }

  const app = express();

  app.use(helmet({
    contentSecurityPolicy: false,
    frameguard: false,
  }));
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('tiny', { skip: (req, res) => res.statusCode < 400 }));

  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/platforms', platformsRouter);
  app.use('/api/records', recordsRouter);
  app.use('/api/collect', collectRouter);
  app.use('/api/alerts', alertsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/recipients', recipientsRouter);
  app.use('/api/health', healthRouter);

  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'), err => {
      if (err) next(err);
    });
  });

  app.use(notFound);
  app.use(errorHandler);

  startCron();

  app.listen(config.port, () => {
    logger.info('========================================');
    logger.info('AI 模型费用监控系统已启动');
    logger.info(`端口: ${config.port}  环境: ${config.env}`);
    logger.info(`面板: ${config.dashboardUrl}`);
    logger.info(`采集: ${config.collect.cron} (每 1 小时)`);
    logger.info(`数据库: ${dbOk ? '已连接' : '未连接'}`);
    logger.info('========================================');
  });
}

start().catch(e => {
  logger.error('启动失败:', e);
  process.exit(1);
});

module.exports = { start };
