const http = require('../../utils/http');
const config = require('../../config');
const { md5 } = require('../../utils/crypto');
const logger = require('../../utils/logger');

// SendCloud 短信发送：POST https://api.sendcloud.net/smsapi/send
// 签名：参与签名的参数按名排序拼接 key=value&...，末尾追加 &smsKey，MD5 小写（值不 urlencode）
async function sendSms(phones, vars) {
  if (!config.sendcloud.smsUser || !config.sendcloud.smsKey) {
    throw new Error('SendCloud 短信凭证未配置 (SENDCLOUD_SMS_USER/SMS_KEY)');
  }
  if (!config.sendcloud.smsTemplateId) throw new Error('短信模板ID未配置 (SENDCLOUD_SMS_TEMPLATE_ID)');
  if (!phones || !phones.length) throw new Error('短信接收手机号为空');

  const phoneStr = phones.join(';');
  const varsStr = JSON.stringify(vars);
  const timestamp = String(Math.floor(Date.now() / 1000));

  // 参与签名的参数（除 signature）
  const params = {
    smsUser: config.sendcloud.smsUser,
    templateId: config.sendcloud.smsTemplateId,
    phone: phoneStr,
    vars: varsStr,
    msgType: '0',
    timestamp,
  };

  // 签名串：参数按名 ASCII 排序，key=value 用 & 连接，末尾加 &smsKey（值不 urlencode）
  const sortedKeys = Object.keys(params).sort();
  const signStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&') + `&${config.sendcloud.smsKey}`;
  const signature = md5(signStr);

  const form = new URLSearchParams();
  for (const k of sortedKeys) form.append(k, params[k]);
  form.append('signature', signature);

  const resp = await http.post(
    'https://api.sendcloud.net/smsapi/send',
    form.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const data = resp.data || {};
  if (data.statusCode === 200 && data.result) {
    const smsIds = data.info && data.info.smsIds;
    logger.info(`📱 短信发送成功 -> ${phoneStr}`);
    return { success: true, msgid: smsIds ? smsIds.join(',') : '' };
  }
  throw new Error(`SendCloud 短信发送失败: ${JSON.stringify(data).slice(0, 300)}`);
}

module.exports = { sendSms };
