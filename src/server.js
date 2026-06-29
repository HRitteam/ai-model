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

// 路由
const dashboardRouter = require('./routes/dashboard');
const platformsRouter = require('./routes/platforms');
const recordsRouter = require('./routes/records');
const collectRouter = require('./routes/collect');
const alertsRouter = require('./routes/alerts');
const settingsRouter = require('./routes/settings');
const recipientsRouter = require('./routes/recipients');
const healthRouter = require('./routes/health');

async function start() {
  // 初始化数据库（首次建表+注入种子）
  try {
    await initDatabase();
  } catch (e) {
    logger.error('数据库初始化失败（可能表已存在或连接失败）:', e.message);
  }

  const dbOk = await testConnection();
  if (!dbOk) {
    logger.warn('⚠️ MySQL 连接失败，系统以降级模式启动（采集/告警暂不可用）');
  }

  const app = express();

  // 中间件
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('tiny', { skip: (req, res) => res.statusCode < 400 }));

  // API 路由
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/platforms', platformsRouter);
  app.use('/api/records', recordsRouter);
  app.use('/api/collect', collectRouter);
  app.use('/api/alerts', alertsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/recipients', recipientsRouter);
  app.use('/api/health', healthRouter);

  // 静态资源
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // SPA fallback：非 API 的 GET 请求返回 index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'), err => {
      if (err) next(err);
    });
  });

  app.use(notFound);
  app.use(errorHandler);

  // 启动定时采集
  startCron();

  app.listen(config.port, () => {
    logger.info('════════════════════════════════════════');
    logger.info('  ⚡ 大模型API费用监控系统已启动');
    logger.info(`  端口: ${config.port}  环境: ${config.env}`);
    logger.info(`  面板: ${config.dashboardUrl}`);
    logger.info(`  采集: ${config.collect.cron} (每6小时)`);
    logger.info(`  数据库: ${dbOk ? '✓ 已连接' : '✗ 未连接'}`);
    logger.info('════════════════════════════════════════');
  });
}

start().catch(e => {
  logger.error('启动失败:', e);
  process.exit(1);
});

module.exports = { start };
