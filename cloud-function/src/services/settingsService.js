const { pool } = require('../db/pool');

async function getSettings() {
  const { rows } = await pool.query("SELECT * FROM settings ORDER BY id");
  return rows;
}

async function getSettingsKV() {
  const rows = await getSettings();
  const kv = {};
  for (const r of rows) kv[r.key] = r.value;
  return kv;
}

async function updateSettings(kv) {
  for (const [key, value] of Object.entries(kv)) {
    await pool.query(
      "INSERT INTO settings(key, value, value_type, description) VALUES($1,$2,'string','') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value",
      [key, String(value)]
    );
  }
  return await getSettings();
}

module.exports = { getSettings, getSettingsKV, updateSettings };
