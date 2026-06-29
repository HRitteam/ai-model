const crypto = require('crypto');

function md5(str) {
  return crypto.createHash('md5').update(str, 'utf8').digest('hex');
}

function hmacSha256Hex(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex');
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * 按点分路径从对象取值，支持数组下标如 data.balance_infos.0.total_balance
 */
function getJsonPath(obj, pathStr) {
  if (!pathStr) return undefined;
  const parts = pathStr.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

module.exports = { md5, hmacSha256Hex, sha256Hex, getJsonPath };
