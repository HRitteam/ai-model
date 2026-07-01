const CloudBase = require('@cloudbase/manager-node');
const logger = require('../utils/logger');

let appInstance = null;

function getEnvId() {
  return process.env.TCB_ENV
    || process.env.SCF_NAMESPACE
    || process.env.TENCENTCLOUD_RUNENV
    || process.env.CLOUDBASE_ENV_ID
    || '';
}

function getApp() {
  if (!appInstance) {
    const secretId = process.env.TENCENTCLOUD_SECRETID || process.env.TCB_SECRET_ID || '';
    const secretKey = process.env.TENCENTCLOUD_SECRETKEY || process.env.TCB_SECRET_KEY || '';
    const token = process.env.TENCENTCLOUD_SESSIONTOKEN || process.env.TCB_SESSION_TOKEN || '';
    const initOptions = { envId: getEnvId() };

    if (secretId && secretKey) {
      initOptions.secretId = secretId;
      initOptions.secretKey = secretKey;
      if (token) initOptions.token = token;
    }

    appInstance = CloudBase.init(initOptions);
  }
  return appInstance;
}

function mysqlToPgSql(sql) {
  let idx = 0;
  return sql.replace(/\?/g, () => {
    idx += 1;
    return `$${idx}`;
  });
}

function sqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (val instanceof Date) return `'${val.toISOString()}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

function interpolateParams(sql, params = []) {
  let finalSql = mysqlToPgSql(sql);
  params.forEach((val, i) => {
    finalSql = finalSql.replace(new RegExp(`\\$${i + 1}(?!\\d)`, 'g'), sqlValue(val));
  });
  return finalSql;
}

function normalizeResult(res) {
  if (res && res.Rows && res.Columns) {
    const rows = res.Rows.map(rowStr => {
      const arr = JSON.parse(rowStr);
      const obj = {};
      res.Columns.forEach((col, i) => {
        obj[col] = normalizePgValue(arr[i]);
      });
      return obj;
    });
    return { rows, rowCount: rows.length };
  }
  return { rows: [], rowCount: Number(res && res.AffectedRows) || 0 };
}

function normalizePgValue(value) {
  if (typeof value !== 'string') return value;

  const match = value.match(
    /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+([+-])(\d{2})(\d{2})(?:\s+[A-Z]+)?$/
  );
  if (!match) return value;

  const [, date, time, sign, hour, minute] = match;
  return `${date}T${time}${sign}${hour}:${minute}`;
}

async function query(sql, params = []) {
  const finalSql = interpolateParams(sql, params);

  try {
    const app = getApp();
    const res = await app.database.executePGSql({ Sql: finalSql });
    return normalizeResult(res);
  } catch (e) {
    logger.error('PostgreSQL query failed:', e.message, '| SQL:', finalSql.substring(0, 300));
    throw e;
  }
}

const pool = { query };

async function testConnection() {
  try {
    const app = getApp();
    const res = await app.database.executePGSql({ Sql: 'SELECT 1 AS ok' });
    return !!(res && res.Rows && res.Rows.length > 0);
  } catch (err) {
    logger.error('PostgreSQL connection failed:', err.message);
    return false;
  }
}

module.exports = { pool, testConnection, getEnvId };
