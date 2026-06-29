const express = require('express');
const asyncWrapper = require('../middleware/asyncWrapper');
const { success, fail } = require('../utils/response');
const platformService = require('../services/platformService');

const router = express.Router();

// GET /api/platforms - 平台列表
router.get('/', asyncWrapper(async (req, res) => {
  const data = await platformService.list();
  return success(res, data);
}));

// GET /api/platforms/:code - 单平台详情
router.get('/:code', asyncWrapper(async (req, res) => {
  const data = await platformService.getByCode(req.params.code);
  if (!data) return fail(res, '平台不存在', 404);
  return success(res, data);
}));

// PUT /api/platforms/:code - 更新平台配置(阈值/状态等)
router.put('/:code', asyncWrapper(async (req, res) => {
  const data = await platformService.update(req.params.code, req.body);
  if (!data) return fail(res, '平台不存在或无更新字段', 404);
  return success(res, data, '更新成功');
}));

module.exports = router;
