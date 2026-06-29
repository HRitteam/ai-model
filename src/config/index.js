const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  logLevel: process.env.LOG_LEVEL || 'info',

  db: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'ai_cost_monitor',
    poolSize: parseInt(process.env.MYSQL_POOL_SIZE || '10', 10),
  },

  collect: {
    cron: process.env.COLLECT_CRON || '0 */6 * * *',
    timeoutMs: parseInt(process.env.COLLECT_TIMEOUT_MS || '15000', 10),
  },

  alert: {
    yellowThreshold: parseFloat(process.env.YELLOW_THRESHOLD || '500'),
    redThreshold: parseFloat(process.env.RED_THRESHOLD || '200'),
    redRepeatHours: parseInt(process.env.RED_REPEAT_HOURS || '6', 10),
    emailTo: (process.env.ALERT_EMAIL_TO || '').split(',').map(s => s.trim()).filter(Boolean),
    smsPhones: (process.env.ALERT_SMS_PHONES || '').split(',').map(s => s.trim()).filter(Boolean),
    // 邮件通道提供商：aliyun | sendcloud
    mailProvider: (process.env.ALERT_MAIL_PROVIDER || 'sendcloud').toLowerCase(),
  },

  dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:3000',
  recordRetentionDays: parseInt(process.env.RECORD_RETENTION_DAYS || '90', 10),

  // 平台凭证
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  },
  kimi: {
    apiKey: process.env.MOONSHOT_API_KEY || '',
    baseUrl: process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn',
  },
  volc: {
    ak: process.env.VOLC_AK || '',
    sk: process.env.VOLC_SK || '',
    region: process.env.VOLC_REGION || 'cn-north-1',
  },
  openaihub: {
    baseUrl: process.env.OPENAIHUB_BASE_URL || 'https://api.openai-hub.com',
    token: process.env.OPENAIHUB_TOKEN || '',
    userId: process.env.OPENAIHUB_USER_ID || '',
  },
  zhipu: {
    cookie: process.env.ZHIPU_COOKIE || '',
    balanceUrl: process.env.ZHIPU_BALANCE_URL || '',
    balanceField: process.env.ZHIPU_BALANCE_FIELD || 'data.balance',
    currencyField: process.env.ZHIPU_CURRENCY_FIELD || '',
    extraHeaders: process.env.ZHIPU_EXTRA_HEADERS || '',
    token: process.env.ZHIPU_TOKEN || '',
    quotaUrl: process.env.ZHIPU_QUOTA_URL || 'https://open.bigmodel.cn/api/monitor/usage/quota/limit',
  },
  minimax: {
    cookie: process.env.MINIMAX_COOKIE || '',
    balanceUrl: process.env.MINIMAX_BALANCE_URL || '',
    balanceField: process.env.MINIMAX_BALANCE_FIELD || 'data.balance',
    currencyField: process.env.MINIMAX_CURRENCY_FIELD || '',
    extraHeaders: process.env.MINIMAX_EXTRA_HEADERS || '',
  },

  sendcloud: {
    apiUser: process.env.SENDCLOUD_API_USER || '',
    apiKey: process.env.SENDCLOUD_API_KEY || '',
    fromEmail: process.env.SENDCLOUD_FROM_EMAIL || '',
    fromName: process.env.SENDCLOUD_FROM_NAME || 'AI费用监控',
    mailTemplate: process.env.SENDCLOUD_MAIL_TEMPLATE || 'model_api_balance_warning',
    smsUser: process.env.SENDCLOUD_SMS_USER || '',
    smsKey: process.env.SENDCLOUD_SMS_KEY || '',
    smsTemplateId: process.env.SENDCLOUD_SMS_TEMPLATE_ID || '',
    smsSign: process.env.SENDCLOUD_SMS_SIGN || 'AI费用监控',
  },

  // 阿里云 DirectMail 邮件通道
  aliyunDm: {
    accessKeyId: process.env.ALIYUN_DM_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ALIYUN_DM_ACCESS_KEY_SECRET || '',
    accountName: process.env.ALIYUN_DM_ACCOUNT_NAME || '',
    fromAlias: process.env.ALIYUN_DM_FROM_ALIAS || 'AI费用监控',
    region: process.env.ALIYUN_DM_REGION || 'cn-hangzhou',
    endpoint: process.env.ALIYUN_DM_ENDPOINT || 'dm.aliyuncs.com',
  },
};

module.exports = config;
