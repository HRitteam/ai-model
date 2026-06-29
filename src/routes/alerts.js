const express = require('express');
const asyncWrapper = require('../middleware/asyncWrapper');
const { success } = require('../utils/response');
const alertService = require('../services/alertService');

const router = express.Router();

// GET /api/alerts - 告警日志(分页)
router.get('/', asyncWrapper(async (req, res) => {
  const data = await alertService.listAlerts({
    platform: req.query.platform,
    level: req.query.level,
    page: req.query.page,
    size: req.query.size,
    isTest: req.query.is_test !== undefined ? parseInt(req.query.is_test) : undefined,
  });
  return success(res, data);
}));

// POST /api/alerts/test - 测试告警通道 { channel: 'email'|'sms'|'all', platform? }
router.post('/test', asyncWrapper(async (req, res) => {
  const channel = req.body.channel || 'all';
  const platformCode = req.body.platform;
  const result = await alertService.testAlert(channel, platformCode);
  return success(res, result, '测试告警已发送');
}));

module.exports = router;
