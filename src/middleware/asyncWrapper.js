// async 路由包装：自动捕获 Promise 异常交给 errorHandler
const asyncWrapper = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncWrapper;
