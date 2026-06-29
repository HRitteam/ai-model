const cron = require('node-cron');
const config = require('../config');
const logger = require('../utils/logger');
const { collectAll } = require('../collectors/runner');

let cronTask = null;

// 启动定时采集任务，默认每 1 小时执行一次
function startCron(cronExpr) {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }

  const expr = cronExpr || config.collect.cron;
  if (!cron.validate(expr)) {
    logger.error(`无效的 cron 表达式: ${expr}，定时任务未启动`);
    return;
  }

  cronTask = cron.schedule(expr, async () => {
    logger.info('定时采集任务触发');
    try {
      await collectAll();
    } catch (e) {
      logger.error('定时采集失败:', e.message);
    }
  });

  logger.info(`定时采集任务已启动 [${expr}]`);
}

function stopCron() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
}

module.exports = { startCron, stopCron };
