const { pool } = require('./pool');
const config = require('../config');
const logger = require('../utils/logger');

async function syncSetting(key, value, valueType = 'string') {
  if (value === undefined || value === null || value === '') return;

  await pool.query(
    `INSERT INTO settings(key, value, value_type, description)
     VALUES($1,$2,$3,$4)
     ON CONFLICT (key)
     DO UPDATE SET value=EXCLUDED.value, value_type=EXCLUDED.value_type`,
    [key, String(value), valueType, '']
  );
}

async function initDatabase() {
  try {
    await syncSetting('alert_email_to', config.alert.emailTo.join(','));
    await syncSetting('alert_sms_phones', config.alert.smsPhones.join(','));
    await syncSetting('dashboard_url', config.dashboardUrl);
    await syncSetting('yellow_threshold', config.alert.yellowThreshold, 'number');
    await syncSetting('red_threshold', config.alert.redThreshold, 'number');
    await syncSetting('red_repeat_hours', config.alert.redRepeatHours, 'number');
    await syncSetting('collect_cron', config.collect.cron);
    await syncSetting('collect_interval_hours', 1, 'number');
    await syncSetting('record_retention_days', config.recordRetentionDays, 'number');

    logger.info('PostgreSQL settings synced');
  } catch (e) {
    logger.error('PostgreSQL init failed:', e.message);
    throw e;
  }
}

module.exports = { initDatabase, syncSetting };
