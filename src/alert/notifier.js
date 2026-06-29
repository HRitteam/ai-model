const { pool } = require('../db/pool');
const logger = require('../utils/logger');
const { sendMail } = require('./channels/sendcloudMail');
const { sendSms } = require('./channels/sendcloudSms');
const { buildMailVars, buildSmsVars } = require('./templates');
const config = require('../config');

function parseList(s) {
  return (s || '').split(/[,，]/).map(x => x.trim()).filter(Boolean);
}

// 统一通知入口：发送邮件+短信，每渠道独立写 alert_log
// 返回各渠道结果 [{ channel, status, msgid?, error? }]
async function notify(platform, level, balance, threshold, alertKey, settings) {
  const checkTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  const mailVars = buildMailVars(platform, level, balance, threshold, checkTime);
  const smsVars = buildSmsVars(platform, level, balance, threshold);

  const emails = parseList(settings.alert_email_to);
  const phones = parseList(settings.alert_sms_phones);
  const emailEnabled = settings.alert_email_enabled !== 'false';
  const smsEnabled = settings.alert_sms_enabled !== 'false';

  const results = [];

  // 邮件渠道
  if (emailEnabled && emails.length) {
    try {
      const r = await sendMail(emails, mailVars);
      results.push({ channel: 'email', status: 'success', msgid: r.msgid });
      await logAlert(platform.id, level, threshold, balance, 'email', alertKey, 'success', r.msgid, null);
    } catch (e) {
      results.push({ channel: 'email', status: 'failed', error: e.message });
      await logAlert(platform.id, level, threshold, balance, 'email', alertKey, 'failed', null, e.message);
      logger.error('邮件发送失败:', e.message);
    }
  } else if (emailEnabled && !emails.length) {
    logger.warn('邮件告警已启用但无收件人配置');
  }

  // 短信渠道
  if (smsEnabled && phones.length) {
    try {
      const r = await sendSms(phones, smsVars);
      results.push({ channel: 'sms', status: 'success', msgid: r.msgid });
      await logAlert(platform.id, level, threshold, balance, 'sms', alertKey, 'success', r.msgid, null);
    } catch (e) {
      results.push({ channel: 'sms', status: 'failed', error: e.message });
      await logAlert(platform.id, level, threshold, balance, 'sms', alertKey, 'failed', null, e.message);
      logger.error('短信发送失败:', e.message);
    }
  } else if (smsEnabled && !phones.length) {
    logger.warn('短信告警已启用但无接收手机号配置');
  }

  return results;
}

// 写告警日志
async function logAlert(platformId, level, threshold, balance, channel, alertKey, status, msgid, error) {
  try {
    await pool.query(
      "INSERT INTO alert_log(platform_id,alert_level,threshold,balance,channel,alert_key,status,provider_msgid,is_test,error_msg) VALUES(?,?,?,?,?,?,?,?,0,?)",
      [platformId, level, threshold, balance, channel, alertKey, status, msgid, error]
    );
  } catch (e) {
    logger.error('写告警日志失败:', e.message);
  }
}

// 手动测试通道：发送测试邮件/短信（不评估阈值，标记 is_test=1）
async function notifyTest(platform, channel, settings) {
  const checkTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  const pName = platform ? platform.name : '测试平台';
  const pCurrency = platform ? (platform.currency || 'CNY') : 'CNY';

  const mailVars = {
    platform_name: pName,
    threshold: '500',
    balance: '888.88',
    currency: pCurrency,
    alert_class: 'warning',
    alert_level: '测试告警',
    balance_class: 'warning',
    check_time: checkTime,
    dashboard_url: config.dashboardUrl,
    send_time: checkTime,
  };
  const smsVars = {
    platform_name: pName,
    threshold: '500',
    balance: '888.88',
    url: config.dashboardUrl,
  };

  const emails = parseList(settings.alert_email_to);
  const phones = parseList(settings.alert_sms_phones);
  const results = {};

  if (channel === 'email' || channel === 'all') {
    if (!emails.length) results.email = { status: 'failed', error: '无收件人配置' };
    else {
      try {
        const r = await sendMail(emails, mailVars);
        results.email = { status: 'success', msgid: r.msgid };
        await logTest(platform ? platform.id : 0, 'email', 'success', r.msgid, null);
      } catch (e) {
        results.email = { status: 'failed', error: e.message };
        await logTest(platform ? platform.id : 0, 'email', 'failed', null, e.message);
      }
    }
  }
  if (channel === 'sms' || channel === 'all') {
    if (!phones.length) results.sms = { status: 'failed', error: '无接收手机号配置' };
    else {
      try {
        const r = await sendSms(phones, smsVars);
        results.sms = { status: 'success', msgid: r.msgid };
        await logTest(platform ? platform.id : 0, 'sms', 'success', r.msgid, null);
      } catch (e) {
        results.sms = { status: 'failed', error: e.message };
        await logTest(platform ? platform.id : 0, 'sms', 'failed', null, e.message);
      }
    }
  }
  return results;
}

async function logTest(platformId, channel, status, msgid, error) {
  try {
    await pool.query(
      "INSERT INTO alert_log(platform_id,alert_level,threshold,balance,channel,alert_key,status,provider_msgid,is_test,error_msg) VALUES(?,?,?,?,?,?,?,?,1,?)",
      [platformId || 0, 'yellow', 0, 0, channel, `test:${Date.now()}`, status, msgid, error]
    );
  } catch (_) {}
}

module.exports = { notify, notifyTest, logAlert };
