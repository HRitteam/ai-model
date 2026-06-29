// 主逻辑：加载 dashboard、趋势、轮询刷新
let dashboardData = null;
let currentRange = '7d';

async function loadDashboard() {
  try {
    const data = await API.dashboard();
    dashboardData = data;
    renderGrid(data.platforms);
    renderSummary(data.summary);
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
