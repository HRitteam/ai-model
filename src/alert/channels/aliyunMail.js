const { RPCClient } = require('@alicloud/pop-core');
const config = require('../../config');
const logger = require('../../utils/logger');
const { buildAlertHtml, escapeHtml } = require('../templates');

// 阿里云 DirectMail 邮件发送
// 接口：SingleSendMail（RPC 风格，apiVersion 2015-11-23）
// 注意：SingleSendMail 的 ToAddress 仅支持单个收件人，群发需循环调用
let _client = null;

function getClient() {
  if (_client) return _client;
  const cfg = config.aliyunDm;
  if (!cfg.accessKeyId || !cfg.accessKeySecret) {
    throw new Error('阿里云 DirectMail 凭证未配置 (ALIYUN_DM_ACCESS_KEY_ID/SECRET)');
  }
  _client = new RPCClient({
    accessKeyId: cfg.accessKeyId,
    accessKeySecret: cfg.accessKeySecret,
    endpoint: `https://${cfg.endpoint}`,
    apiVersion: '2015-11-23',
  });
  return _client;
}

// 原始发送：自定义 subject + htmlBody，群发循环调用
async function sendMailRaw(toList, subject, htmlBody) {
  const cfg = config.aliyunDm;
  if (!cfg.accountName) throw new Error('阿里云 DirectMail 发信地址未配置 (ALIYUN_DM_ACCOUNT_NAME)');
  if (!toList || !toList.length) throw new Error('邮件收件人为空');

  const client = getClient();
  const msgIds = [];
  const errors = [];

  for (const to of toList) {
    try {
      const resp = await client.request('SingleSendMail', {
        AccountName: cfg.accountName,
        FromAlias: cfg.fromAlias,
        AddressType: 1,
        ReplyToAddress: true,
        ToAddress: to,
        Subject: subject,
        HtmlBody: htmlBody,
      });
      const envId = resp && resp.EnvId ? String(resp.EnvId) : '';
      if (resp && resp.Code) {
        errors.push(`${to}: ${resp.Code} ${resp.Message || ''}`.trim());
        logger.error(`阿里云邮件发送失败 ${to}: ${resp.Code} ${resp.Message || ''}`);
      } else {
        msgIds.push(envId);
        logger.info(`📧 阿里云邮件发送成功 -> ${to} (EnvId=${envId})`);
      }
    } catch (e) {
      errors.push(`${to}: ${e.message}`);
      logger.error(`阿里云邮件发送异常 ${to}: ${e.message}`);
    }
  }

  if (msgIds.length === 0) {
    throw new Error(`阿里云邮件全部发送失败: ${errors.join('; ').slice(0, 500)}`);
  }
  return { success: true, msgid: msgIds.join(','), partial: errors.length > 0 ? errors : undefined };
}

// 单平台告警邮件（兼容原有签名）
// toList: string[] 收件人列表
// vars: buildMailVars 的返回值
async function sendMail(toList, vars) {
  const cfg = config.aliyunDm;
  if (!cfg.accountName) throw new Error('阿里云 DirectMail 发信地址未配置 (ALIYUN_DM_ACCOUNT_NAME)');
  if (!toList || !toList.length) throw new Error('邮件收件人为空');

  const subject = `【费用预警】${vars.platform_name} API余额不足 ${vars.threshold}元 - 当前余额${vars.balance}元`;
  const htmlBody = buildAlertHtml(vars);
  return await sendMailRaw(toList, subject, htmlBody);
}

module.exports = { sendMail, sendMailRaw, escapeHtml };
