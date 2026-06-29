const express = require('express');
const asyncWrapper = require('../middleware/asyncWrapper');
const { success } = require('../utils/response');
const logger = require('../utils/logger');

const router = express.Router();

// POST /api/collect - 手动触发采集（异步触发，立即返回）
router.post('/', asyncWrapper(async (req, res) => {
  const { collectAll } = require('../collectors/runner');
  collectAll().catch(e => logger.error('手动采集失败:', e.message));
  return success(res, { status: 'started' }, '采集已触发，请稍后刷新查看结果');
}));

module.exports = router;
