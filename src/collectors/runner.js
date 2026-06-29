const { pool } = require('../db/pool');
const logger = require('../utils/logger');
const config = require('../config');
const { createCollector } = require('./registry');
const { CredentialMissingError, CookieExpiredError } = require('../utils/errors');

let collecting = false;

// 采集调度执行器：遍历启用平台，逐个采集，写库后触发告警评估
async function collectAll() {
  if (collecting) {
    logger.warn('采集进行中，跳过本次触发');
    return null;
  }

  collecting = true;
  logger.info('====== 开始采集 ======');
  try {
    const [platforms] = await pool.query(
      'SELECT * FROM platforms WHERE status=1 ORDER BY display_order'
    );

    const results = [];
    for (const p of platforms) {
      const r = await collectOne(p);
      results.push({ platform: p, ...r });
    }

    logger.info('====== 采集完成 ======');

    const okResults = results.filter(r => r.status === 'ok' && r.balance != null);
    if (okResults.length) {
      try {
        const alertEngine = require('../alert/engine');
        await alertEngine.evaluateAll(okResults);
      } catch (e) {
        logger.error('告警评估失败:', e.message);
      }
    }

    try {
      const deleted = await cleanupOldRecords();
      if (deleted > 0) {
        logger.info(`清理历史采集记录完成，删除 ${deleted} 条`);
      }
    } catch (e) {
      logger.error('清理历史采集记录失败:', e.message);
    }

    return results;
  } finally {
    collecting = false;
  }
}

async function collectOne(platform) {
  const collector = createCollector(platform);
  if (!collector) {
    logger.warn(`平台 ${platform.code} 无采集器`);
    return { status: 'disabled' };
  }

  const now = new Date();
  try {
    if (!collector.isConfigured()) {
      await updatePlatform(platform.id, 'unconfigured', null, now, '凭证未配置');
      logger.warn(`⊘ ${platform.code}: 未配置凭证，跳过`);
      return { status: 'unconfigured' };
    }

    const result = await collector.collect();
    await pool.query(
      "INSERT INTO balance_records(platform_id,balance,currency,consumed,raw_response,collected_at,status) VALUES(?,?,?,?,?,?, 'ok')",
      [platform.id, result.balance, result.currency, result.consumed, JSON.stringify(result.raw), now]
    );
    await updatePlatform(platform.id, 'ok', result.balance, now, null);
    logger.info(`✓ ${platform.code}: ${result.balance} ${result.currency}`);
    return { status: 'ok', balance: result.balance, currency: result.currency };
  } catch (err) {
    const isCookie = err instanceof CookieExpiredError;
    const isCred = err instanceof CredentialMissingError;
    const status = isCred ? 'unconfigured' : (isCookie ? 'cookie_expired' : 'error');

    await pool.query(
      'INSERT INTO balance_records(platform_id,balance,currency,collected_at,status,error_msg) VALUES(?,?,?,?,?,?)',
      [platform.id, null, platform.currency, now, 'error', err.message]
    );
    await updatePlatform(platform.id, status, null, now, err.message);
    logger.error(`✗ ${platform.code}: ${err.message}`);
    return { status, error: err.message };
  }
}

async function updatePlatform(id, status, balance, collectedAt, error) {
  await pool.query(
    'UPDATE platforms SET last_status=?, last_balance=?, last_collected_at=?, last_error=? WHERE id=?',
    [status, balance, collectedAt, error, id]
  );
}

async function cleanupOldRecords() {
  const retentionDays = Number.isFinite(config.recordRetentionDays) ? config.recordRetentionDays : 90;
  const cutoffDays = Math.max(1, retentionDays);

  const [result] = await pool.query(
    `DELETE br
     FROM balance_records br
     LEFT JOIN (
       SELECT
         platform_id,
         DATE(collected_at) AS keep_date,
         MIN(id) AS keep_id
       FROM balance_records
       WHERE collected_at < DATE_SUB(NOW(), INTERVAL ? DAY)
         AND HOUR(collected_at) = 1
       GROUP BY platform_id, DATE(collected_at)
     ) keepers
       ON keepers.keep_id = br.id
     WHERE br.collected_at < DATE_SUB(NOW(), INTERVAL ? DAY)
       AND keepers.keep_id IS NULL`,
    [cutoffDays, cutoffDays]
  );

  return result && typeof result.affectedRows === 'number' ? result.affectedRows : 0;
}

module.exports = { collectAll, collectOne, cleanupOldRecords };
