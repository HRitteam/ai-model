const { pool } = require('../db/pool');
const { createCollector } = require('../collectors/registry');

function isPlatformConfigured(p) {
  const c = createCollector(p);
  return c ? c.isConfigured() : false;
}

async function list() {
  const [rows] = await pool.query("SELECT * FROM platforms ORDER BY display_order");
  return rows.map(p => ({ ...p, is_configured: isPlatformConfigured(p) }));
}

async function getByCode(code) {
  const [rows] = await pool.query("SELECT * FROM platforms WHERE code=?", [code]);
  if (!rows.length) return null;
  const p = rows[0];
  const [recent] = await pool.query(
    "SELECT * FROM balance_records WHERE platform_id=? ORDER BY collected_at DESC LIMIT 10",
    [p.id]
  );
  return { ...p, is_configured: isPlatformConfigured(p), recent_records: recent };
}

async function update(code, fields) {
  const allowed = ['status', 'yellow_threshold', 'red_threshold', 'display_order', 'balance_field', 'balance_divisor', 'currency'];
  const sets = [];
  const params = [];
  for (const k of allowed) {
    if (fields[k] !== undefined) {
      sets.push(`${k}=?`);
      params.push(fields[k]);
    }
  }
  if (!sets.length) return null;
  params.push(code);
  await pool.query(`UPDATE platforms SET ${sets.join(',')} WHERE code=?`, params);
  return getByCode(code);
}

module.exports = { list, getByCode, update, isPlatformConfigured };
