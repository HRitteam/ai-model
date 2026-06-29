const http = require('../../utils/http');
const config = require('../../config');
const logger = require('../../utils/logger');

// SendCloud 邮件模板发送：POST https://api.sendcloud.net/apiv2/mail/sendtemplate
// 模板变量通过 xsmtpapi 的 sub 字段传递（变量名用 %xxx% 包裹）
async function sendMail(toList, vars) {
  if (!config.sendcloud.apiUser || !config.sendcloud.apiKey) {
    throw new Error('SendCloud 邮件凭证未配置 (SENDCLOUD_API_USER/API_KEY)');
  }
  if (!toList || !toList.length) throw new Error('邮件收件人为空');

  // 构造 xsmtpapi
  const sub = {};
  for (const [k, v] of Object.entries(vars)) {
    sub[`%${k}%`] = [String(v)];
  }
  const xsmtpapi = JSON.stringify({ to: toList, sub });

  const params = new URLSearchParams();
  params.append('apiUser', config.sendcloud.apiUser);
  params.append('apiKey', config.sendcloud.apiKey);
  params.append('from', config.sendcloud.fromEmail);
  params.append('fromName', config.sendcloud.fromName);
  params.append('templateInvokeName', config.sendcloud.mailTemplate);
  params.append('subject', `【费用预警】${vars.platform_name} API余额不足 ${vars.threshold}元 - 当前余额${vars.balance}元`);
  params.append('xsmtpapi', xsmtpapi);

  const resp = await http.post(
    'https://api.sendcloud.net/apiv2/mail/sendtemplate',
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const data = resp.data || {};
  if (data.statusCode === 200 && data.result) {
    const emailIds = data.info && data.info.emailIdList;
    logger.info(`📧 邮件发送成功 -> ${toList.join(',')}`);
    return { success: true, msgid: emailIds ? emailIds.join(',') : '' };
  }
  throw new Error(`SendCloud 邮件发送失败: ${JSON.stringify(data).slice(0, 300)}`);
}

// 原始发送（自定义 subject + htmlBody），用于合并告警邮件
// SendCloud 普通发送接口：POST https://api.sendcloud.net/apiv2/mail/send
async function sendMailRaw(toList, subject, htmlBody) {
  if (!config.sendcloud.apiUser || !config.sendcloud.apiKey) {
    throw new Error('SendCloud 邮件凭证未配置 (SENDCLOUD_API_USER/API_KEY)');
  }
  if (!toList || !toList.length) throw new Error('邮件收件人为空');

  // 普通发送支持多个收件人，用逗号分隔
  const params = new URLSearchParams();
  params.append('apiUser', config.sendcloud.apiUser);
  params.append('apiKey', config.sendcloud.apiKey);
  params.append('from', config.sendcloud.fromEmail);
  params.append('fromName', config.sendcloud.fromName);
  params.append('to', toList.join(','));
  params.append('subject', subject);
  params.append('html', htmlBody);

  const resp = await http.post(
    'https://api.sendcloud.net/apiv2/mail/send',
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const data = resp.data || {};
  if (data.statusCode === 200 && data.result) {
    const emailIds = data.info && data.info.emailIdList;
    logger.info(`📧 邮件发送成功 -> ${toList.join(',')}`);
    return { success: true, msgid: emailIds ? emailIds.join(',') : '' };
  }
  throw new Error(`SendCloud 邮件发送失败: ${JSON.stringify(data).slice(0, 300)}`);
}

module.exports = { sendMail, sendMailRaw };
