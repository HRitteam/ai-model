const { pool } = require('../db/pool');
const logger = require('../utils/logger');
const config = require('../config');
const {
  buildMailVars,
  buildSmsVars,
  buildMergedAlertHtml,
  buildMergedAlertSubject,
} = require('./templates');
const recipientService = require('../services/recipientService');
const { sendMail, sendMailRaw } = require('./channels/aliyunMail');
const { sendSms } = require('./channels/sendcloudSms');

function parseList(s) {
  return (s || '').split(/[,，;]/).map(x => x.trim()).filter(Boolean);
}

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
  if (!emails.length) emails = parseList(settings.alert_email_to);
  if (!phones.length) phones = parseList(settings.alert_sms_phones);
  return { emails, phones };
}

async function notify(platform, level, balance, threshold, alertKey, settings) {
  const dashboardUrl = settings.dashboard_url || config.dashboardUrl;
  const checkTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  const mailVars = buildMailVars(platform, level, balance, threshold, checkTime, dashboardUrl);
  const smsVars = buildSmsVars(platform, level, balance, threshold, dashboardUrl);
  const { emails, phones } = await getContacts(settings);
  const emailEnabled = settings.alert_email_enabled !== 'false';
  const smsEnabled = settings.alert_sms_enabled !== 'false';
  const results = [];

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
    logger.warn('邮件告警已启用但无收件人配置（请在发送人管理中添加）');
  }

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

async function notifyMerged(alertItems, mergedAlertKey, settings) {
  if (!alertItems || !alertItems.length) return { email: null, sms: null };

  const { emails, phones } = await getContacts(settings);
  const emailEnabled = settings.alert_email_enabled !== 'false';
  const smsEnabled = settings.alert_sms_enabled !== 'false';
  const dashboardUrl = settings.dashboard_url || config.dashboardUrl;
  const results = { email: null, sms: null };

  if (emailEnabled && emails.length) {
    try {
      const subject = buildMergedAlertSubject(alertItems);
      const htmlBody = buildMergedAlertHtml(alertItems, dashboardUrl);
      const r = await sendMailRaw(emails, subject, htmlBody);
      results.email = { status: 'success', msgid: r.msgid };
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

  if (smsEnabled && phones.length) {
    try {
      const msgIds = [];
      for (const it of alertItems) {
        const smsVars = buildSmsVars(it.platform, it.level, it.balance, it.threshold, dashboardUrl);
        const r = await sendSms(phones, smsVars);
        if (r.msgid) msgIds.push(r.msgid);
      }
      const mergedMsgid = msgIds.join(',');
      results.sms = { status: 'success', msgid: mergedMsgid };
      for (const it of alertItems) {
        await logAlert(it.platform.id, it.level, it.threshold, it.balance, 'sms', mergedAlertKey, 'success', mergedMsgid, null);
      }
      logger.info(`📫 合并告警短信发送成功 -> ${phones.length} 个收件人，涉及 ${alertItems.length} 个平台`);
    } catch (e) {
      results.sms = { status: 'failed', error: e.message };
      for (const it of alertItems) {
        await logAlert(it.platform.id, it.level, it.threshold, it.balance, 'sms', mergedAlertKey, 'failed', null, e.message);
      }
      logger.error('合并告警短信发送失败:', e.message);
    }
  } else if (smsEnabled && !phones.length) {
    logger.warn('合并告警短信已启用但无接收手机号配置');
  }

  return results;
}

async function sendManualNotification(platform, channel, settings) {
  if (!platform) {
    throw new Error('请选择需要发送通知的平台');
  }

  const yellowTh = platform.yellow_threshold != null
    ? parseFloat(platform.yellow_threshold)
    : parseFloat(settings.yellow_threshold || config.alert.yellowThreshold);
  const redTh = platform.red_threshold != null
    ? parseFloat(platform.red_threshold)
    : parseFloat(settings.red_threshold || config.alert.redThreshold);
  const balance = platform.last_balance != null ? parseFloat(platform.last_balance) : null;

  if (balance == null || Number.isNaN(balance)) {
    throw new Error(`${platform.name} 暂无可用余额数据，请先执行采集`);
  }

  let level = 'normal';
  let threshold = yellowTh;
  if (balance < redTh) {
    level = 'red';
    threshold = redTh;
  } else if (balance < yellowTh) {
    level = 'yellow';
    threshold = yellowTh;
  }

  const dashboardUrl = settings.dashboard_url || config.dashboardUrl;
  const checkTime = platform.last_collected_at
    ? new Date(platform.last_collected_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
    : new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  const mailVars = buildMailVars(platform, level, balance, threshold, checkTime, dashboardUrl);
  const smsVars = buildSmsVars(platform, level, balance, threshold, dashboardUrl);
  const { emails, phones } = await getContacts(settings);
  const results = {};
  const manualKey = `manual:${platform.code}:${Date.now()}`;

  if (channel === 'email' || channel === 'all') {
    if (!emails.length) {
      results.email = { status: 'failed', error: '无收件人配置（请在发送人管理中添加）' };
    } else {
      try {
        const r = await sendMail(emails, mailVars);
        results.email = { status: 'success', msgid: r.msgid };
        await logAlert(platform.id, level, threshold, balance, 'email', manualKey, 'success', r.msgid, null);
      } catch (e) {
        results.email = { status: 'failed', error: e.message };
        await logAlert(platform.id, level, threshold, balance, 'email', manualKey, 'failed', null, e.message);
      }
    }
  }

  if (channel === 'sms' || channel === 'all') {
    if (!phones.length) {
      results.sms = { status: 'failed', error: '无接收手机号配置' };
    } else {
      try {
        const r = await sendSms(phones, smsVars);
        results.sms = { status: 'success', msgid: r.msgid };
        await logAlert(platform.id, level, threshold, balance, 'sms', manualKey, 'success', r.msgid, null);
      } catch (e) {
        results.sms = { status: 'failed', error: e.message };
        await logAlert(platform.id, level, threshold, balance, 'sms', manualKey, 'failed', null, e.message);
      }
    }
  }

  return results;
}

async function logAlert(platformId, level, threshold, balance, channel, alertKey, status, msgid, error) {
  try {
    await pool.query(
      'INSERT INTO alert_log(platform_id,alert_level,threshold,balance,channel,alert_key,status,provider_msgid,is_test,error_msg) VALUES(?,?,?,?,?,?,?,?,0,?)',
      [platformId, level, threshold, balance, channel, alertKey, status, msgid, error]
    );
  } catch (e) {
    logger.error('写告警日志失败:', e.message);
  }
}

module.exports = { notify, notifyMerged, sendManualNotification, logAlert, getContacts };
