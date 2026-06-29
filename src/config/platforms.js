// 平台元数据：采集器注册与前端展示用
const PLATFORM_META = [
  { code: 'deepseek',  name: 'DeepSeek',   collectType: 'api',    icon: 'DS' },
  { code: 'kimi',      name: 'Kimi',       collectType: 'api',    icon: 'KM' },
  { code: 'volc',      name: '火山引擎',    collectType: 'sdk',    icon: 'VL' },
  { code: 'openaihub', name: 'OpenAI-Hub', collectType: 'api',    icon: 'OH' },
  { code: 'zhipu',     name: '智谱AI',      collectType: 'manual', icon: 'ZP', balanceUrl: 'https://open.bigmodel.cn/finance-center/finance/overview' },
  { code: 'minimax',   name: 'MiniMax',    collectType: 'manual', icon: 'MM', balanceUrl: 'https://platform.minimaxi.com/console/recharge-records' },
];

const META_BY_CODE = PLATFORM_META.reduce((m, p) => { m[p.code] = p; return m; }, {});

module.exports = { PLATFORM_META, META_BY_CODE };
