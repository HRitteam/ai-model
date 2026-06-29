const { pool } = require('../db/pool');

async function getRecords(code, range = '7d') {
  const days = range === '30d' ? 30 : (range === '90d' ? 90 : 7);
  const [rows] = await pool.query(
    "SELECT r.balance, r.currency, r.consumed, r.collected_at, r.status, r.error_msg, p.code, p.name FROM balance_records r JOIN platforms p ON r.platform_id=p.id WHERE p.code=? AND r.collected_at >= DATE_SUB(NOW(), INTERVAL ? DAY) ORDER BY r.collected_at",
    [code, days]
  );
  return rows;
}

// 所有平台趋势（用于中央折线图）
async function getTrendAll(range = '7d') {
  const days = range === '30d' ? 30 : (range === '90d' ? 90 : 7);
  const [rows] = await pool.query(
    "SELECT r.balance, r.currency, r.collected_at, p.code, p.name FROM balance_records r JOIN platforms p ON r.platform_id=p.id WHERE r.status='ok' AND r.collected_at >= DATE_SUB(NOW(), INTERVAL ? DAY) ORDER BY p.code, r.collected_at",
    [days]
  );
  return rows;
}

module.exports = { getRecords, getTrendAll };
