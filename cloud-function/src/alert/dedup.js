const { pool } = require('../db/pool');

async function getState(platformId) {
  // PG 版：用 INSERT ON CONFLICT 实现 upsert
  await pool.query(
    "INSERT INTO alert_state(platform_id, current_level) VALUES($1, 'normal') ON CONFLICT (platform_id) DO NOTHING",
    [platformId]
  );
  const { rows } = await pool.query("SELECT * FROM alert_state WHERE platform_id=$1", [platformId]);
  return rows[0];
}

function buildAlertKey(platformCode, level, redRepeatHours) {
  if (level === 'yellow') return `${platformCode}:yellow`;
  const windowMs = (redRepeatHours || 6) * 3600 * 1000;
  const ws = Math.floor(Date.now() / windowMs) * windowMs;
  const d = new Date(ws);
  const p = n => String(n).padStart(2, '0');
  return `${platformCode}:red:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}`;
}

async function isAlertKeySent(alertKey) {
  const { rows } = await pool.query(
    "SELECT id FROM alert_log WHERE alert_key=$1 AND status='success' LIMIT 1",
    [alertKey]
  );
  return rows.length > 0;
}

module.exports = { getState, buildAlertKey, isAlertKeySent };
