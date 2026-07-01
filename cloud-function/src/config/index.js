const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  brandName: process.env.BRAND_NAME || 'HRflag',
  appName: process.env.APP_NAME || 'AI费用监控',

  db: {
    host: process.env.PG_HOST || process.env.POSTGRES_HOST || '127.0.0.1',
    port: parseInt(process.env.PG_PORT || process.env.POSTGRES_PORT || '5432', 10),
    user: process.env.PG_USER || process.env.POSTGRES_USER || 'postgres',
    password: process.env.PG_PASSWORD || process.env.POSTGRES_PASSWORD || '',
    database: process.env.PG_DATABASE || process.env.POSTGRES_DATABASE || 'postgres',
    poolSize: parseInt(process.env.PG_POOL_SIZE || process.env.DB_POOL_SIZE || '10', 10),
  },

  collect: {
    cron: process.env.COLLECT_CRON || '0 * * * *',
    timeoutMs: parseInt(process.env.COLLECT_TIMEOUT_MS || '15000', 10),
  },

  alert: {
    yellowThreshold: parseFloat(process.env.YELLOW_THRESHOLD || '500'),
    redThreshold: parseFloat(process.env.RED_THRESHOLD || '200'),
    redRepeatHours: parseInt(process.env.RED_REPEAT_HOURS || '6', 10),
    emailTo: (process.env.ALERT_EMAIL_TO || '').split(',').map(s => s.trim()).filter(Boolean),
    smsPhones: (process.env.ALERT_SMS_PHONES || '').split(',').map(s => s.trim()).filter(Boolean),
  },

  dashboardUrl: process.env.DASHBOARD_URL || 'https://aimodel.hrflag.com',
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
    estimate: {
      enabled: process.env.ZHIPU_ESTIMATE_ENABLED === 'true',
      usageUrl: process.env.ZHIPU_USAGE_URL || '',
      method: process.env.ZHIPU_USAGE_METHOD || 'GET',
      authType: process.env.ZHIPU_USAGE_AUTH_TYPE || 'none',
      authHeader: process.env.ZHIPU_USAGE_AUTH_HEADER || '',
      authToken: process.env.ZHIPU_USAGE_AUTH_TOKEN || '',
      authCookie: process.env.ZHIPU_USAGE_AUTH_COOKIE || '',
      extraHeaders: process.env.ZHIPU_USAGE_EXTRA_HEADERS || '',
      body: process.env.ZHIPU_USAGE_BODY || '',
      totalBudget: process.env.ZHIPU_TOTAL_BUDGET || '',
      currency: process.env.ZHIPU_ESTIMATE_CURRENCY || 'CNY',
      consumedField: process.env.ZHIPU_CONSUMED_FIELD || '',
      itemsField: process.env.ZHIPU_USAGE_ITEMS_FIELD || '',
      modelField: process.env.ZHIPU_USAGE_MODEL_FIELD || '',
      inputTokensField: process.env.ZHIPU_INPUT_TOKENS_FIELD || '',
      outputTokensField: process.env.ZHIPU_OUTPUT_TOKENS_FIELD || '',
      cachedInputTokensField: process.env.ZHIPU_CACHED_INPUT_TOKENS_FIELD || '',
      priceRules: process.env.ZHIPU_PRICE_RULES || '',
    },
  },
  minimax: {
    cookie: process.env.MINIMAX_COOKIE || '',
    balanceUrl: process.env.MINIMAX_BALANCE_URL || '',
    balanceField: process.env.MINIMAX_BALANCE_FIELD || 'data.balance',
    currencyField: process.env.MINIMAX_CURRENCY_FIELD || '',
    extraHeaders: process.env.MINIMAX_EXTRA_HEADERS || '',
    estimate: {
      enabled: process.env.MINIMAX_ESTIMATE_ENABLED === 'true',
      usageUrl: process.env.MINIMAX_USAGE_URL || '',
      method: process.env.MINIMAX_USAGE_METHOD || 'GET',
      authType: process.env.MINIMAX_USAGE_AUTH_TYPE || 'none',
      authHeader: process.env.MINIMAX_USAGE_AUTH_HEADER || '',
      authToken: process.env.MINIMAX_USAGE_AUTH_TOKEN || '',
      authCookie: process.env.MINIMAX_USAGE_AUTH_COOKIE || '',
      extraHeaders: process.env.MINIMAX_USAGE_EXTRA_HEADERS || '',
      body: process.env.MINIMAX_USAGE_BODY || '',
      totalBudget: process.env.MINIMAX_TOTAL_BUDGET || '',
      currency: process.env.MINIMAX_ESTIMATE_CURRENCY || 'CNY',
      consumedField: process.env.MINIMAX_CONSUMED_FIELD || '',
      itemsField: process.env.MINIMAX_USAGE_ITEMS_FIELD || '',
      modelField: process.env.MINIMAX_USAGE_MODEL_FIELD || '',
      inputTokensField: process.env.MINIMAX_INPUT_TOKENS_FIELD || '',
      outputTokensField: process.env.MINIMAX_OUTPUT_TOKENS_FIELD || '',
      cachedInputTokensField: process.env.MINIMAX_CACHED_INPUT_TOKENS_FIELD || '',
      priceRules: process.env.MINIMAX_PRICE_RULES || '',
    },
  },

  sendcloud: {
    smsUser: process.env.SENDCLOUD_SMS_USER || '',
    smsKey: process.env.SENDCLOUD_SMS_KEY || '',
    smsTemplateId: process.env.SENDCLOUD_SMS_TEMPLATE_ID || '940146',
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
