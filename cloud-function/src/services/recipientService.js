const { pool } = require('../db/pool');

function validate(r) {
  const errors = [];
  if (!r.name || !String(r.name).trim()) errors.push('姓名必填');
  if (!r.phone || !String(r.phone).trim()) errors.push('手机号必填');
  if (!r.email || !String(r.email).trim()) errors.push('邮箱必填');
  if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(r.email).trim())) {
    errors.push('邮箱格式不正确');
  }
  if (r.phone && !/^[\d\-+()\s]{6,20}$/.test(String(r.phone).trim())) {
    errors.push('手机号格式不正确');
  }
  return errors;
}

async function list({ all = false } = {}) {
  const sql = all
    ? 'SELECT * FROM recipients ORDER BY id'
    : 'SELECT * FROM recipients WHERE enabled=1 ORDER BY id';
  const { rows } = await pool.query(sql);
  return rows;
}

async function create({ name, phone, email, enabled = 1, remark = null }) {
  const errs = validate({ name, phone, email });
  if (errs.length) throw new Error(errs.join('; '));
  const { rows } = await pool.query(
    'INSERT INTO recipients(name,phone,email,enabled,remark) VALUES($1,$2,$3,$4,$5) RETURNING id',
    [String(name).trim(), String(phone).trim(), String(email).trim(), enabled ? 1 : 0, remark || null]
  );
  return { id: rows[0].id };
}

async function update(id, fields) {
  const allowed = ['name', 'phone', 'email', 'enabled', 'remark'];
  const sets = [];
  const vals = [];
  let idx = 1;
  for (const k of allowed) {
    if (fields[k] !== undefined) {
      if (k === 'enabled') {
        sets.push(`enabled=$${idx}`); vals.push(fields[k] ? 1 : 0);
      } else if (k === 'name' || k === 'phone' || k === 'email') {
        sets.push(`${k}=$${idx}`); vals.push(String(fields[k]).trim());
      } else {
        sets.push(`${k}=$${idx}`); vals.push(fields[k]);
      }
      idx++;
    }
  }
  if (!sets.length) throw new Error('无更新字段');
  const { rows: cur } = await pool.query('SELECT * FROM recipients WHERE id=$1', [id]);
  if (!cur.length) throw new Error('接收人不存在');
  const merged = { ...cur[0], ...fields };
  const errs = validate(merged);
  if (errs.length) throw new Error(errs.join('; '));
  vals.push(id);
  await pool.query(`UPDATE recipients SET ${sets.join(',')} WHERE id=$${idx}`, vals);
  return { id };
}

async function remove(id) {
  const result = await pool.query('DELETE FROM recipients WHERE id=$1', [id]);
  if (result.rowCount === 0) throw new Error('接收人不存在');
  return { id };
}

async function getActiveContacts() {
  const { rows } = await pool.query('SELECT name,phone,email FROM recipients WHERE enabled=1 ORDER BY id');
  const emails = rows.map(r => r.email);
  const phones = rows.map(r => r.phone);
  return { emails, phones, rows };
}

module.exports = { list, create, update, remove, getActiveContacts, validate };
