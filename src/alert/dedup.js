const { pool } = require('../db/pool');

// 获取或创建平台告警状态机（每平台一行）
async function getState(platformId) {
  await pool.query(
    "INSERT IGNORE INTO alert_state(platform_id, current_level) VALUES(?, 'normal')",
    [platformId]
  );
  const [rows] = await pool.query("SELECT * FROM alert_state WHERE platform_id=?", [platformId]);
  return rows[0];
}

// 构造去重键 alert_key
// - 黄色：固定 {code}:yellow（同一轮低余额周期只发一次）
// - 红色：基于绝对时间的 redRepeatHours 小时窗口 {code}:red:{yyyyMMddHH}(UTC)
function buildAlertKey(platformCode, level, redRepeatHours) {
  if (level === 'yellow') return `${platformCode}:yellow`;
  const windowMs = (redRepeatHours || 6) * 3600 * 1000;
  const ws = Math.floor(Date.now() / windowMs) * windowMs;
  const d = new Date(ws);
  const p = n => String(n).padStart(2, '0');
  return `${platformCode}:red:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}`;
}

// 双保险：检查 alert_key 是否已成功发送过
async function isAlertKeySent(alertKey) {
  const [rows] = await pool.query(
    "SELECT id FROM alert_log WHERE alert_key=? AND status='success' LIMIT 1",
    [alertKey]
  );
  return rows.length > 0;
}

module.exports = { getState, buildAlertKey, isAlertKeySent };
