const http = require('../../utils/http');
const config = require('../../config');
const { md5 } = require('../../utils/crypto');
const logger = require('../../utils/logger');

function validateSmsVars(vars) {
  for (const [key, value] of Object.entries(vars || {})) {
    const text = value == null ? '' : String(value);
    if (text.length > 16) {
      throw new Error(`SendCloud 短信变量超长: ${key}=${text}，长度 ${text.length}，限制 16 个字符`);
    }
  }
}

async function sendSms(phones, vars) {
  if (!config.sendcloud.smsUser || !config.sendcloud.smsKey) {
    throw new Error('SendCloud 短信凭证未配置 (SENDCLOUD_SMS_USER/SMS_KEY)');
  }
  if (!config.sendcloud.smsTemplateId) {
    throw new Error('短信模板ID未配置 (SENDCLOUD_SMS_TEMPLATE_ID)');
  }
  if (!phones || !phones.length) {
    throw new Error('短信接收手机号为空');
  }

  validateSmsVars(vars);

  const phoneStr = phones.join(';');
  const params = [
    ['smsUser', config.sendcloud.smsUser],
    ['templateId', config.sendcloud.smsTemplateId],
    ['phone', phoneStr],
    ['msgType', '0'],
    ['vars', JSON.stringify(vars)],
  ];

  params.sort((a, b) => a[0].localeCompare(b[0]));
  const paramStr = params.map(([key, value]) => `${key}=${value}`).join('&') + '&';
  const signature = md5(`${config.sendcloud.smsKey}&${paramStr}${config.sendcloud.smsKey}`);

  const form = new URLSearchParams();
  for (const [key, value] of params) form.append(key, value);
  form.append('signature', signature);

  const resp = await http.post(
    'https://api.sendcloud.net/smsapi/send',
    form.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const data = resp.data || {};
  if (data.statusCode === 200 && data.result) {
    const smsIds = data.info && data.info.smsIds;
    logger.info(`短信发送成功 -> ${phoneStr}`);
    return { success: true, msgid: smsIds ? smsIds.join(',') : '' };
  }

  throw new Error(`SendCloud 短信发送失败: ${JSON.stringify(data).slice(0, 300)}`);
}

module.exports = { sendSms };
