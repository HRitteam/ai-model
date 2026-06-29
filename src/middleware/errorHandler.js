const logger = require('../utils/logger');

// 全局错误处理中间件（放最后）
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  logger.error(`[${req.method} ${req.originalUrl}]`, err.message || err);
  if (status === 500) logger.debug(err.stack);
  res.status(status).json({
    code: status,
    message: err.message || '服务器内部错误',
    data: null,
  });
}

// 404 处理
function notFound(req, res) {
  res.status(404).json({ code: 404, message: '接口不存在', data: null });
}

module.exports = { errorHandler, notFound };
