const express = require('express');
const asyncWrapper = require('../middleware/asyncWrapper');
const { success } = require('../utils/response');
const dashboardService = require('../services/dashboardService');

const router = express.Router();

// GET /api/dashboard - 首页总览
router.get('/', asyncWrapper(async (req, res) => {
  const data = await dashboardService.getDashboard();
  return success(res, data);
}));

module.exports = router;
