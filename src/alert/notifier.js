const { pool } = require('../db/pool');
const logger = require('../utils/logger');
const config = require('../config');
const { buildMailVars, buildSmsVars, buildMergedAlertHtml, buildMergedSmsContent } = require('./templates');
const recipientService = require('../services/recipientService');

// 根据配置动态加载邮件通道：aliyun | sendcloud
function getMailChannel() {
  const provider = config.alert.mailProvider;
  if (provider === 'aliyun') {
    return require('./channels/aliyunMail');
  }
  return require('./channels/sendcloudMail');
}

const { sendSms } = require('./channels/sendcloudSms');

function parseList(s) {
  return (s || '').split(/[,，]/).map(x => x.trim()).filter(Boolean);
}

// 获取收件人：优先从 recipients 表读，fallback 到 settings 旧字段
async function getContacts(settings) {
  let emails = [];
  let phones = [];
  try {
    const contacts = await recipientService.getActiveContacts();
    emails = contacts.emails;
    phones = contacts.phones;
  } catch (e) {
    logger.warn('读取 recipients 表失败，回退到 settings:', e.message);
  }
  // fallback：recipients 表为空时用 settings 旧字段
  if (!emails.length) emails = parseList(settings.alert_email_to);
  if (!phones.length) phones = parseList(settings.alert_sms_phones);
  return { emails, phones };
}

// 单平台通知入口：发送邮件+短信，每渠道独立写 alert_log
// 返回各渠道结果 [{ channel, status, msgid?, error? }]
async function notify(platform, level, balance, threshold, alertKey, settings) {
  const checkTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  const mailVars = buildMailVars(platform, level, balance, threshold, checkTime);
  const smsVars = buildSmsVars(platform, level, balance, threshold);

  const { emails, phones } = await getContacts(settings);
  const emailEnabled = settings.alert_email_enabled !== 'false';
  const smsEnabled = settings.alert_sms_enabled !== 'false';

  const results = [];

  // 邮件渠道
  if (emailEnabled && emails.length) {
    try {
      const { sendMail } = getMailChannel();
      const r = await sendMail(emails, mailVars);
      results.push({ channel: 'email', status: 'success', msgid: r.msgid });
      await logAlert(platform.id, level, threshold, balance, 'email', alertKey, 'success', r.msgid, null);
    } catch (e) {
      results.push({ channel: 'email', status: 'failed', error: e.message });
      await logAlert(platform.id, level, threshold, balance, 'email', alertKey, 'failed', null, e.message);
      logger.error('邮件发送失败:', e.message);
    }
  } else if (emailEnabled && !emails.length) {
    logger.warn('邮件告警已启用但无收件人配置（请在发送人管理中添加）');
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

// 合并通知：把多个告警平台汇总到一封邮件 + 一条短信
// alertItems: [{ platform, level, balance, threshold }]
// mergedAlertKey: 合并去重键
// 返回 { email, sms }
async function notifyMerged(alertItems, mergedAlertKey, settings) {
  if (!alertItems || !alertItems.length) return { email: null, sms: null };

  const { emails, phones } = await getContacts(settings);
  const emailEnabled = settings.alert_email_enabled !== 'false';
  const smsEnabled = settings.alert_sms_enabled !== 'false';
  const results = { email: null, sms: null };

  const dashboardUrl = settings.dashboard_url || config.dashboardUrl;
  const hasRed = alertItems.some(it => it.level === 'red');
  const titleLevel = hasRed ? '红色+黄色' : '黄色';
  const subject = `【费用预警】AI费用合并告警(${titleLevel}) - 共${alertItems.length}个平台触发`;
  const htmlBody = buildMergedAlertHtml(alertItems, dashboardUrl);

  // 邮件渠道
  if (emailEnabled && emails.length) {
    try {
      const { sendMailRaw } = getMailChannel();
      const r = await sendMailRaw(emails, subject, htmlBody);
      results.email = { status: 'success', msgid: r.msgid };
      // 为每个涉及平台写一条 alert_log
      for (const it of alertItems) {
        await logAlert(it.platform.id, it.level, it.threshold, it.balance, 'email', mergedAlertKey, 'success', r.msgid, null);
      }
      logger.info(`📧 合并告警邮件发送成功 -> ${emails.length} 个收件人，涉及 ${alertItems.length} 个平台`);
    } catch (e) {
      results.email = { status: 'failed', error: e.message };
      for (const it of alertItems) {
        await logAlert(it.platform.id, it.level, it.threshold, it.balance, 'email', mergedAlertKey, 'failed', null, e.message);
      }
      logger.error('合并告警邮件发送失败:', e.message);
    }
  } else if (emailEnabled && !emails.length) {
    logger.warn('合并告警邮件已启用但无收件人配置（请在发送人管理中添加）');
  }

  // 短信渠道
  if (smsEnabled && phones.length) {
    try {
      const smsVars = buildMergedSmsContent(alertItems, dashboardUrl);
      const r = await sendSms(phones, smsVars);
      results.sms = { status: 'success', msgid: r.msgid };
      for (const it of alertItems) {
        await logAlert(it.platform.id, it.level, it.threshold, it.balance, 'sms', mergedAlertKey, 'success', r.msgid, null);
      }
      logger.info(`📱 合并告警短信发送成功 -> ${phones.length} 个收件人`);
    } catch (e) {
      results.sms = { status: 'failed', error: e.message };
      for (const it of alertItems) {
        await logAlert(it.platform.id, it.level, it.threshold, it.balance, 'sms', mergedAlertKey, 'failed', null, e.message);
      }
      logger.error('合并告警短信发送失败:', e.message);
    }
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

  const { emails, phones } = await getContacts(settings);
  const results = {};

  if (channel === 'email' || channel === 'all') {
    if (!emails.length) results.email = { status: 'failed', error: '无收件人配置（请在发送人管理中添加）' };
    else {
      try {
        const { sendMail } = getMailChannel();
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

module.exports = { notify, notifyMerged, notifyTest, logAlert, getContacts };
