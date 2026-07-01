const { pool } = require('../db/pool');
const { sendManualNotification } = require('../alert/notifier');
const { getSettings } = require('../alert/engine');

async function listAlerts({ platform, level, page = 1, size = 20, isTest } = {}) {
  const where = ['1=1'];
  const params = [];
  let idx = 1;
  if (platform) { where.push(`p.code=$${idx}`); params.push(platform); idx++; }
  if (level) { where.push(`a.alert_level=$${idx}`); params.push(level); idx++; }
  if (isTest !== undefined) { where.push(`a.is_test=$${idx}`); params.push(isTest); idx++; }
  const whereSql = where.join(' AND ');
  const offset = (parseInt(page, 10) - 1) * parseInt(size, 10);

  const { rows } = await pool.query(
    `SELECT a.*, p.code, p.name FROM alert_log a LEFT JOIN platforms p ON a.platform_id=p.id WHERE ${whereSql} ORDER BY a.sent_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, parseInt(size, 10), offset]
  );
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) as total FROM alert_log a LEFT JOIN platforms p ON a.platform_id=p.id WHERE ${whereSql}`,
    params
  );
  return { list: rows, total: parseInt(countRows[0].total, 10), page: parseInt(page, 10), size: parseInt(size, 10) };
}

async function sendNotification(channel, platformCode) {
  const settings = await getSettings();
  let platform = null;
  if (platformCode) {
    const { rows } = await pool.query('SELECT * FROM platforms WHERE code=$1', [platformCode]);
    platform = rows[0] || null;
  }
  return await sendManualNotification(platform, channel, settings);
}

module.exports = { listAlerts, sendNotification };
