const CLOUD_ENV_ID = 'workbuddy-d4grmkz5t1ad0515e';
const CLOUD_FUNCTION_NAME = 'ai-cost-monitor-api';
let cloudApp = null;
let authReady = null;

function getCloudApp() {
  if (cloudApp) return cloudApp;
  if (!window.cloudbase) {
    throw new Error('CloudBase SDK 未加载');
  }
  cloudApp = window.cloudbase.init({ env: CLOUD_ENV_ID });
  return cloudApp;
}

async function ensureAuth() {
  if (authReady) return authReady;
  authReady = (async () => {
    const app = getCloudApp();
    const auth = app.auth();
    const state = await auth.getLoginState().catch(() => null);
    if (!state) {
      const result = await auth.signInAnonymously();
      if (result && result.error) {
        throw new Error(result.error.message || 'CloudBase 匿名登录失败');
      }
    }
  })();
  return authReady;
}

function splitUrl(url) {
  const u = new URL(url, window.location.origin);
  const queryStringParameters = {};
  u.searchParams.forEach((value, key) => {
    queryStringParameters[key] = value;
  });
  return { path: u.pathname, queryStringParameters };
}

async function callApi(url, opt = {}) {
  await ensureAuth();
  const app = getCloudApp();
  const method = (opt.method || 'GET').toUpperCase();
  const { path, queryStringParameters } = splitUrl(url);
  const res = await app.callFunction({
    name: CLOUD_FUNCTION_NAME,
    data: {
      httpMethod: method,
      path,
      headers: { 'Content-Type': 'application/json' },
      queryStringParameters,
      body: opt.body || '',
    },
  });

  const result = res.result || res;
  const statusCode = Number(result.statusCode || 200);
  const body = typeof result.body === 'string' ? JSON.parse(result.body || '{}') : result;
  if (statusCode >= 400) {
    throw new Error(body.message || `云函数请求失败(${statusCode})`);
  }
  return body;
}

const API = {
  async _req(url, opt = {}) {
    try {
      const j = await callApi(url, opt);
      if (j.code !== 0) throw new Error(j.message || '请求失败');
      return j.data;
    } catch (e) {
      throw new Error(e.message || '网络错误');
    }
  },
  get(url) {
    return this._req(url, {});
  },
  post(url, body) {
    return this._req(url, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    });
  },
  put(url, body) {
    return this._req(url, {
      method: 'PUT',
      body: JSON.stringify(body || {}),
    });
  },
  del(url) {
    return this._req(url, { method: 'DELETE' });
  },
  dashboard: () => API.get('/api/dashboard'),
  platforms: () => API.get('/api/platforms'),
  records: (code, range) => API.get(`/api/records/${code}?range=${range || '7d'}`),
  trend: (range) => API.get(`/api/records?range=${range || '7d'}`),
  collect: () => API.post('/api/collect'),
  alerts: (params) => API.get('/api/alerts' + (params ? ('?' + new URLSearchParams(params)) : '')),
  sendNotification: (channel, platform) => API.post('/api/alerts/send', { channel, platform }),
  testAlert: (channel, platform) => API.post('/api/alerts/send', { channel, platform }),
  settings: () => API.get('/api/settings'),
  updateSettings: (kv) => API.put('/api/settings', kv),
  health: () => API.get('/api/health'),
  recipients: (all) => API.get('/api/recipients' + (all ? '?all=true' : '')),
  addRecipient: (r) => API.post('/api/recipients', r),
  updateRecipient: (id, r) => API.put('/api/recipients/' + id, r),
  delRecipient: (id) => API.del('/api/recipients/' + id),
};

window.API = API;

window.H = {
  formatNum(n) {
    if (n == null || n === '') return '--';
    return Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  },
  fmtTime(s) {
    if (!s) return '--';
    const d = new Date(s);
    if (isNaN(d)) return String(s);
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  },
  iconUrl(code) {
    const icons = {
      deepseek: 'https://deepseek.com/favicon.ico',
      kimi: 'https://kimi.moonshot.cn/favicon.ico',
      volc: 'http://res.volccdn.com/obj/volc-console-fe/images/favicon.52bcaa41.png',
      openaihub: 'https://www.openai-hub.com/logo.webp',
      zhipu: 'https://cdn.bigmodel.cn/static/platform/images/modelcenter/base-model-logo.svg',
      minimax: 'https://platform.minimaxi.com/favicon.ico',
    };
    return icons[code] || '';
  },
  balanceUrl(code) {
    const urls = {
      zhipu: 'https://open.bigmodel.cn/finance-center/finance/overview',
      minimax: 'https://platform.minimaxi.com/console/recharge-records',
    };
    return urls[code] || '';
  },
  iconOf(code) {
    const m = { deepseek: 'DS', kimi: 'KM', volc: 'VL', openaihub: 'OH', zhipu: 'ZP', minimax: 'MM' };
    return m[code] || (code || '').slice(0, 2).toUpperCase();
  },
  levelColor(level) {
    return { normal: '#3FB950', yellow: '#D4A843', red: '#FF4444', unknown: '#555F6D' }[level] || '#4A90D9';
  },
};
