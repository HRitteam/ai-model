const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * 首次初始化：建表、注入种子数据、同步 .env 中的接收人/阈值到 settings
 * 兼容阿里云 RDS：CREATE DATABASE 用 try-catch，无权限时跳过（库已预建）
 */
async function initDatabase() {
  // 先尝试不带 database 连接（用于建库）
  let conn;
  try {
    conn = await mysql.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      charset: 'utf8mb4',
      multipleStatements: true,
    });

    logger.info(`初始化数据库: ${config.db.host}:${config.db.port}/${config.db.database}`);

    // 尝试建库，无权限则跳过（阿里云 RDS 库已预建）
    try {
      await conn.query(
        `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
    } catch (e) {
      logger.warn(`建库跳过（可能无权限或库已存在）: ${e.message}`);
    }
    await conn.query(`USE \`${config.db.database}\``);
  } catch (e) {
    // 不带 database 连接失败时，尝试直接带 database 连接（阿里云 RDS 场景）
    logger.warn(`无库连接失败，尝试直连数据库: ${e.message}`);
    conn = await mysql.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      charset: 'utf8mb4',
      multipleStatements: true,
    });
    logger.info(`初始化数据库(直连): ${config.db.host}:${config.db.port}/${config.db.database}`);
  }

  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await conn.query(schemaSql);
  logger.info('✓ 表结构创建完成');

  const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
  await conn.query(seedSql);
  logger.info('✓ 初始数据注入完成');

  // 从 .env 同步敏感配置到 settings 表
  const sync = async (key, value) => {
    if (value !== undefined && value !== null && value !== '') {
      await conn.query('INSERT INTO settings(`key`,value,value_type,description) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE value=VALUES(value)',
        [key, String(value), 'string', '']);
    }
  };
  await sync('alert_email_to', config.alert.emailTo.join(','));
  await sync('alert_sms_phones', config.alert.smsPhones.join(','));
  await sync('dashboard_url', config.dashboardUrl);
  await sync('yellow_threshold', config.alert.yellowThreshold);
  await sync('red_threshold', config.alert.redThreshold);
  await sync('red_repeat_hours', config.alert.redRepeatHours);

  await conn.end();
  logger.info('✓ 数据库初始化成功');
}

if (require.main === module) {
  initDatabase()
    .then(() => { logger.info('初始化完成，退出'); process.exit(0); })
    .catch(err => { logger.error('初始化失败:', err); process.exit(1); });
}

module.exports = { initDatabase };
