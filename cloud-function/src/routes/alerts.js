const express = require('express');
const asyncWrapper = require('../middleware/asyncWrapper');
const { success } = require('../utils/response');
const alertService = require('../services/alertService');

const router = express.Router();

router.get('/', asyncWrapper(async (req, res) => {
  const data = await alertService.listAlerts({
    platform: req.query.platform,
    level: req.query.level,
    page: req.query.page,
    size: req.query.size,
    isTest: req.query.is_test !== undefined ? parseInt(req.query.is_test, 10) : undefined,
  });
  return success(res, data);
}));

router.post('/send', asyncWrapper(async (req, res) => {
  const channel = req.body.channel || 'all';
  const platformCode = req.body.platform;
  const result = await alertService.sendNotification(channel, platformCode);
  return success(res, result, '通知已发送');
}));

router.post('/test', asyncWrapper(async (req, res) => {
  const channel = req.body.channel || 'all';
  const platformCode = req.body.platform;
  const result = await alertService.sendNotification(channel, platformCode);
  return success(res, result, '通知已发送');
}));

module.exports = router;
