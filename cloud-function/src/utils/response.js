// 统一响应 helper
function success(res, data = null, message = 'ok') {
  return res.json({ code: 0, message, data });
}

function fail(res, message = '失败', status = 400, data = null) {
  return res.status(status).json({ code: status, message, data });
}

module.exports = { success, fail };
