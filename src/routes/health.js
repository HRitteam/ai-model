const express = require('express');
const asyncWrapper = require('../middleware/asyncWrapper');
const { success } = require('../utils/response');
const { testConnection } = require('../db/pool');
const platformService = require('../services/platformService');

const router = express.Router();

// GET /api/health - 健康检查（DB 不可用时也能返回降级状态）
router.get('/', asyncWrapper(async (req, res) => {
  const dbOk = await testConnection();
  let platforms = [];
  let configured = 0;
  if (dbOk) {
    try {
      platforms = await platformService.list();
      configured = platforms.filter(p => p.is_configured).length;
    } catch (_) {}
  }
  return success(res, {
    status: dbOk ? 'ok' : 'degraded',
    db: dbOk ? 'connected' : 'disconnected',
    platforms_total: platforms.length,
    platforms_configured: configured,
    uptime: Math.floor(process.uptime()),
    time: new Date().toISOString(),
  });
}));

module.exports = router;
