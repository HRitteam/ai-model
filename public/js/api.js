// 后端 API 封装 + 通用工具
const API = {
  async _req(url, opt) {
    try {
      const r = await fetch(url, opt);
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message || '请求失败');
      return j.data;
    } catch (e) {
      throw new Error(e.message || '网络错误');
    }
  },
  get(url) { return this._req(url, {}); },
  post(url, body) { return this._req(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); },
  put(url, body) { return this._req(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); },
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
  delRecipient: (id) => API._req('/api/recipients/' + id, { method: 'DELETE' }),
};

// 通用 helpers（全局）
window.H = {
  formatNum(n) {
    if (n == null || n === '') return '--';
    return Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  },
  fmtTime(s) {
    if (!s) return '--';
    const d = new Date(s);
    if (isNaN(d)) return String(s);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  },
  // 平台图标 URL（使用各平台公开 logo / favicon）
  iconUrl(code) {
    const icons = {
      deepseek:   'https://deepseek.com/favicon.ico',
      kimi:       'https://kimi.moonshot.cn/favicon.ico',
      volc:       'http://res.volccdn.com/obj/volc-console-fe/images/favicon.52bcaa41.png',
      openaihub:  'https://www.openai-hub.com/logo.webp',
      zhipu:      'https://cdn.bigmodel.cn/static/platform/images/modelcenter/base-model-logo.svg',
      minimax:    'https://platform.minimaxi.com/favicon.ico',
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
  iconOf(code) { // 兼容旧调用
    const m = { deepseek: 'DS', kimi: 'KM', volc: 'VL', openaihub: 'OH', zhipu: 'ZP', minimax: 'MM' };
    return m[code] || (code || '').slice(0, 2).toUpperCase();
  },
  levelColor(level) {
    return { normal: '#3FB950', yellow: '#D4A843', red: '#FF4444', unknown: '#555F6D' }[level] || '#4A90D9';
  },
};
