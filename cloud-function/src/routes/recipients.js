const express = require('express');
const asyncWrapper = require('../middleware/asyncWrapper');
const { success, fail } = require('../utils/response');
const recipientService = require('../services/recipientService');

const router = express.Router();

// GET /api/recipients?all=true  列表(默认只返回启用的)
router.get('/', asyncWrapper(async (req, res) => {
  const data = await recipientService.list({ all: req.query.all === 'true' });
  return success(res, data);
}));

// POST /api/recipients  新增 { name, phone, email, enabled?, remark? }
router.post('/', asyncWrapper(async (req, res) => {
  const data = await recipientService.create(req.body || {});
  return success(res, data, '新增成功');
}));

// PUT /api/recipients/:id  更新
router.put('/:id', asyncWrapper(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return fail(res, '无效的 id');
  const data = await recipientService.update(id, req.body || {});
  return success(res, data, '更新成功');
}));

// DELETE /api/recipients/:id  删除
router.delete('/:id', asyncWrapper(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return fail(res, '无效的 id');
  const data = await recipientService.remove(id);
  return success(res, data, '删除成功');
}));

module.exports = router;
