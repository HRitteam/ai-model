const { pool } = require('../db/pool');

// 校验：姓名、手机号、邮箱必填
function validate(r) {
  const errors = [];
  if (!r.name || !String(r.name).trim()) errors.push('姓名必填');
  if (!r.phone || !String(r.phone).trim()) errors.push('手机号必填');
  if (!r.email || !String(r.email).trim()) errors.push('邮箱必填');
  // 简单格式校验
  if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(r.email).trim())) {
    errors.push('邮箱格式不正确');
  }
  if (r.phone && !/^[\d\-+()\s]{6,20}$/.test(String(r.phone).trim())) {
    errors.push('手机号格式不正确');
  }
  return errors;
}

// 列表（默认只返回启用的；?all=true 返回全部）
async function list({ all = false } = {}) {
  const sql = all
    ? 'SELECT * FROM recipients ORDER BY id'
    : 'SELECT * FROM recipients WHERE enabled=1 ORDER BY id';
  const [rows] = await pool.query(sql);
  return rows;
}

// 新增
async function create({ name, phone, email, enabled = 1, remark = null }) {
  const errs = validate({ name, phone, email });
  if (errs.length) throw new Error(errs.join('; '));
  const [r] = await pool.query(
    'INSERT INTO recipients(name,phone,email,enabled,remark) VALUES(?,?,?,?,?)',
    [String(name).trim(), String(phone).trim(), String(email).trim(), enabled ? 1 : 0, remark || null]
  );
  return { id: r.insertId };
}

// 更新
async function update(id, fields) {
  const allowed = ['name', 'phone', 'email', 'enabled', 'remark'];
  const sets = [];
  const vals = [];
  for (const k of allowed) {
    if (fields[k] !== undefined) {
      if (k === 'enabled') {
        sets.push('enabled=?'); vals.push(fields[k] ? 1 : 0);
      } else if (k === 'name' || k === 'phone' || k === 'email') {
        sets.push(`${k}=?`); vals.push(String(fields[k]).trim());
      } else {
        sets.push(`${k}=?`); vals.push(fields[k]);
      }
    }
  }
  if (!sets.length) throw new Error('无更新字段');
  // 若改了 name/phone/email 需重新校验
  const [cur] = await pool.query('SELECT * FROM recipients WHERE id=?', [id]);
  if (!cur.length) throw new Error('接收人不存在');
  const merged = { ...cur[0], ...fields };
  const errs = validate(merged);
  if (errs.length) throw new Error(errs.join('; '));
  vals.push(id);
  await pool.query(`UPDATE recipients SET ${sets.join(',')} WHERE id=?`, vals);
  return { id };
}

// 删除
async function remove(id) {
  const [r] = await pool.query('DELETE FROM recipients WHERE id=?', [id]);
  if (r.affectedRows === 0) throw new Error('接收人不存在');
  return { id };
}

// 获取启用的收件人邮箱列表和手机号列表（供告警使用）
async function getActiveContacts() {
  const [rows] = await pool.query('SELECT name,phone,email FROM recipients WHERE enabled=1 ORDER BY id');
  const emails = rows.map(r => r.email);
  const phones = rows.map(r => r.phone);
  return { emails, phones, rows };
}

module.exports = { list, create, update, remove, getActiveContacts, validate };
