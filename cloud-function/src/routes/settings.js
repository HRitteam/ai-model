const express = require('express');
const asyncWrapper = require('../middleware/asyncWrapper');
const { success } = require('../utils/response');
const settingsService = require('../services/settingsService');

const router = express.Router();

// GET /api/settings - 系统设置
router.get('/', asyncWrapper(async (req, res) => {
  const data = await settingsService.getSettings();
  return success(res, data);
}));

// PUT /api/settings - 更新设置
router.put('/', asyncWrapper(async (req, res) => {
  const data = await settingsService.updateSettings(req.body || {});
  return success(res, data, '设置已更新');
}));

module.exports = router;
