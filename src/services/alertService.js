const { pool } = require('../db/pool');
const { notifyTest } = require('../alert/notifier');
const { getSettings } = require('../alert/engine');

async function listAlerts({ platform, level, page = 1, size = 20, isTest } = {}) {
  const where = ['1=1'];
  const params = [];
  if (platform) { where.push('p.code=?'); params.push(platform); }
  if (level) { where.push('a.alert_level=?'); params.push(level); }
  if (isTest !== undefined) { where.push('a.is_test=?'); params.push(isTest); }
  const whereSql = where.join(' AND ');
  const offset = (parseInt(page) - 1) * parseInt(size);

  const [rows] = await pool.query(
    `SELECT a.*, p.code, p.name FROM alert_log a LEFT JOIN platforms p ON a.platform_id=p.id WHERE ${whereSql} ORDER BY a.sent_at DESC LIMIT ? OFFSET ?`,
    [...params, parseInt(size), offset]
  );
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM alert_log a LEFT JOIN platforms p ON a.platform_id=p.id WHERE ${whereSql}`,
    params
  );
  return { list: rows, total, page: parseInt(page), size: parseInt(size) };
}

async function testAlert(channel, platformCode) {
  const settings = await getSettings();
  let platform = null;
  if (platformCode) {
    const [rows] = await pool.query("SELECT * FROM platforms WHERE code=?", [platformCode]);
    platform = rows[0] || null;
  }
  return await notifyTest(platform, channel, settings);
}

module.exports = { listAlerts, testAlert };
