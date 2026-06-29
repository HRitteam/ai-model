const http = require('../utils/http');
const { getJsonPath } = require('../utils/crypto');

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function round4(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildTemplateVars() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    today: formatDate(now),
    monthStart: formatDate(monthStart),
    monthEnd: formatDate(now),
    yearMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  };
}

function interpolateString(text, vars) {
  return String(text).replace(/\{\{(\w+)\}\}/g, (_, key) => (
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : ''
  ));
}

function interpolateDeep(value, vars) {
  if (typeof value === 'string') return interpolateString(value, vars);
  if (Array.isArray(value)) return value.map(item => interpolateDeep(item, vars));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, interpolateDeep(val, vars)]));
  }
  return value;
}

function tryParseJson(text, fallback) {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch (_) {
    return fallback;
  }
}

function parseHeaders(extraHeaders, vars) {
  const parsed = tryParseJson(extraHeaders, {});
  const expanded = interpolateDeep(parsed, vars);
  if (expanded && typeof expanded === 'object' && !Array.isArray(expanded)) return expanded;
  return {};
}

function parseBody(bodyText, vars) {
  if (!bodyText) return undefined;
  const expanded = interpolateString(bodyText, vars);
  const trimmed = expanded.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return tryParseJson(trimmed, expanded);
  }
  return expanded;
}

function parsePriceRules(json) {
  const parsed = tryParseJson(json, {});
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function getPriceRule(rules, model) {
  if (model && rules[model]) return rules[model];
  return rules.default || null;
}

function normalizeRule(rule) {
  if (!rule || typeof rule !== 'object') return null;
  return {
    inputPrice: toNumber(rule.inputPrice ?? rule.input_per_million ?? rule.input),
    outputPrice: toNumber(rule.outputPrice ?? rule.output_per_million ?? rule.output),
    cachedInputPrice: toNumber(
      rule.cachedInputPrice ?? rule.cached_input_per_million ?? rule.cached_input ?? rule.cachedInput
    ),
    scale: toNumber(rule.scale, 1000000) || 1000000,
  };
}

function estimateConsumedByItems(data, conf) {
  const source = conf.itemsField ? getJsonPath(data, conf.itemsField) : data;
  const items = Array.isArray(source)
    ? source
    : source && typeof source === 'object'
      ? [source]
      : [];

  if (!items.length) {
    throw new Error(`未从用量接口取到记录列表: ${conf.itemsField || '(root)'}`);
  }

  const rules = parsePriceRules(conf.priceRules);
  let total = 0;

  for (const item of items) {
    const model = conf.modelField ? getJsonPath(item, conf.modelField) : 'default';
    const rule = normalizeRule(getPriceRule(rules, model));
    if (!rule) {
      throw new Error(`缺少模型 ${model || 'default'} 的价格配置`);
    }

    const inputTokens = toNumber(getJsonPath(item, conf.inputTokensField));
    const outputTokens = toNumber(getJsonPath(item, conf.outputTokensField));
    const cachedInputTokens = conf.cachedInputTokensField
      ? toNumber(getJsonPath(item, conf.cachedInputTokensField))
      : 0;

    total +=
      (inputTokens / rule.scale) * rule.inputPrice +
      (outputTokens / rule.scale) * rule.outputPrice +
      (cachedInputTokens / rule.scale) * rule.cachedInputPrice;
  }

  return round4(total);
}

function isUsageEstimateConfigured(conf = {}) {
  const hasBudget = conf.totalBudget !== '' && conf.totalBudget != null;
  const hasUsageUrl = !!conf.usageUrl;
  const canDirectReadConsumed = !!conf.consumedField;
  const canEstimateByTokens = !!(conf.inputTokensField && conf.outputTokensField && conf.priceRules);
  return !!(conf.enabled && hasBudget && hasUsageUrl && (canDirectReadConsumed || canEstimateByTokens));
}

async function collectUsageEstimate(platform, conf = {}) {
  const vars = buildTemplateVars();
  const url = interpolateString(conf.usageUrl, vars);
  const method = (conf.method || 'GET').toUpperCase();
  const headers = parseHeaders(conf.extraHeaders, vars);
  const body = parseBody(conf.body, vars);
  const authType = (conf.authType || 'none').toLowerCase();

  if (authType === 'bearer' && conf.authToken) {
    headers[conf.authHeader || 'Authorization'] = `Bearer ${conf.authToken}`;
  } else if (authType === 'header' && conf.authToken) {
    headers[conf.authHeader || 'Authorization'] = conf.authToken;
  } else if (authType === 'cookie' && conf.authCookie) {
    headers.Cookie = conf.authCookie;
  }

  const resp = await http.request({ url, method, headers, data: body });
  if (resp.status < 200 || resp.status >= 300) {
    throw new Error(`用量接口返回 HTTP ${resp.status}: ${JSON.stringify(resp.data).slice(0, 300)}`);
  }

  const data = resp.data || {};
  let consumed;
  if (conf.consumedField) {
    const value = getJsonPath(data, conf.consumedField);
    if (value == null) {
      throw new Error(`未找到已消费金额字段: ${conf.consumedField}`);
    }
    consumed = toNumber(value, NaN);
    if (!Number.isFinite(consumed)) {
      throw new Error(`已消费金额字段不是数字: ${conf.consumedField}=${value}`);
    }
  } else {
    consumed = estimateConsumedByItems(data, conf);
  }

  const totalBudget = toNumber(conf.totalBudget, NaN);
  if (!Number.isFinite(totalBudget)) {
    throw new Error(`总预算配置无效: ${conf.totalBudget}`);
  }

  return {
    balance: round4(totalBudget - consumed),
    currency: conf.currency || platform.currency || 'CNY',
    consumed: round4(consumed),
    raw: {
      mode: 'usage_estimate',
      total_budget: totalBudget,
      consumed_amount: round4(consumed),
      response: data,
    },
  };
}

module.exports = {
  isUsageEstimateConfigured,
  collectUsageEstimate,
};
