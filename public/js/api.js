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
  testAlert: (channel, platform) => API.post('/api/alerts/test', { channel, platform }),
  settings: () => API.get('/api/settings'),
  updateSettings: (kv) => API.put('/api/settings', kv),
  health: () => API.get('/api/health'),
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
  iconOf(code) {
    const m = { deepseek: 'DS', kimi: 'KM', volc: 'VL', openaihub: 'OH', zhipu: 'ZP', minimax: 'MM' };
    return m[code] || (code || '').slice(0, 2).toUpperCase();
  },
  levelColor(level) {
    return { normal: '#00ff88', yellow: '#ffcc00', red: '#ff3366', unknown: '#7a8fa6' }[level] || '#00d4ff';
  },
};
