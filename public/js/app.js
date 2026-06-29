// 主逻辑：加载 dashboard、趋势、轮询刷新
let dashboardData = null;
let currentRange = '7d';

async function loadDashboard() {
  try {
    const data = await API.dashboard();
    dashboardData = data;
    renderGrid(data.platforms);
    renderSummary(data.summary);
    renderTicker(data.alerts_recent);
    updateRadar(data.platforms);
    updateSysStatus(data.summary);
  } catch (e) {
    showToast('数据加载失败: ' + e.message, true);
    console.error(e);
  }
}

function renderSummary(s) {
  document.getElementById('okCount').textContent = s.ok_count;
  document.getElementById('warnCount').textContent = s.warning_count;
  document.getElementById('dangerCount').textContent = s.danger_count;
  document.getElementById('lastCollect').textContent = H.fmtTime(s.last_collect_at);
  document.getElementById('nextCollect').textContent = H.fmtTime(s.next_collect_at);
}

function updateSysStatus(s) {
  const dot = document.getElementById('sysDot');
  const txt = document.getElementById('sysStatusText');
  let cls, text;
  if (s.danger_count > 0) { cls = 'dot-red'; text = `红色告警中 (${s.danger_count})`; }
  else if (s.warning_count > 0) { cls = 'dot-yellow'; text = `存在预警 (${s.warning_count})`; }
  else if (s.unconfigured_count > 0) { cls = 'dot-gray'; text = `${s.ok_count}/${s.total} 运行 · ${s.unconfigured_count} 未配置`; }
  else { cls = 'dot-normal'; text = '系统运行正常'; }
  dot.className = 'status-dot ' + cls;
  txt.textContent = text;
}

function renderTicker(alerts) {
  const el = document.getElementById('alertTicker');
  if (!alerts || !alerts.length) {
    el.innerHTML = '<span class="ticker-item" style="color:#5a7a9a">○ 暂无告警记录，系统运行平稳</span>';
    return;
  }
  const buildItem = a => {
    const cls = a.alert_level === 'red' ? 't-red' : 't-yellow';
    const ch = a.channel === 'email' ? '📧' : '📱';
    const pname = a.name || ('#' + a.platform_id);
    const tag = a.is_test ? '[测试]' : (a.alert_level === 'red' ? '[红色]' : '[黄色]');
    return `<span class="ticker-item"><span class="t-time">${H.fmtTime(a.sent_at)}</span><span class="${cls}">${tag}</span> ${pname} 余额${H.formatNum(a.balance)} ${ch} ${a.status === 'success' ? '✓' : '✗'}</span>`;
  };
  const items = alerts.map(buildItem).join('');
  el.innerHTML = items + items; // 复制一份实现无缝滚动
}

// 趋势 tab 切换
document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    loadTrend(t.dataset.range);
  });
});

async function loadTrend(range) {
  currentRange = range || currentRange;
  try {
    const rows = await API.trend(currentRange);
    renderTrend(rows);
  } catch (e) {
    console.error('趋势加载失败', e);
  }
}

// 初始化
async function init() {
  initTrendChart();
  startRadar();
  await loadDashboard();
  await loadTrend('7d');
  // 定时刷新：dashboard 每60s，趋势每5min
  setInterval(loadDashboard, 60000);
  setInterval(() => loadTrend(currentRange), 5 * 60000);
}

if (document.readyState !== 'loading') init();
else document.addEventListener('DOMContentLoaded', init);
