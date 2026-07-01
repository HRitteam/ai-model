const express = require('express');
const asyncWrapper = require('../middleware/asyncWrapper');
const { success } = require('../utils/response');
const recordService = require('../services/recordService');

const router = express.Router();

// GET /api/records?range=7d - 所有平台趋势(中央折线图)
router.get('/', asyncWrapper(async (req, res) => {
  const data = await recordService.getTrendAll(req.query.range);
  return success(res, data);
}));

// GET /api/records/:code?range=7d - 单平台历史记录
router.get('/:code', asyncWrapper(async (req, res) => {
  const data = await recordService.getRecords(req.params.code, req.query.range);
  return success(res, data);
}));

module.exports = router;
