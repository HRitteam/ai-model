// ECharts 折线图 + 雷达点更新
let trendChart = null;

function initTrendChart() {
  const el = document.getElementById('trendChart');
  if (!el || typeof echarts === 'undefined') return;
  trendChart = echarts.init(el);
  window.addEventListener('resize', () => trendChart && trendChart.resize());
}

function renderTrend(rows) {
  if (!trendChart || !rows) return;
  const groups = {};
  for (const r of rows) {
    if (!groups[r.code]) groups[r.code] = { name: r.name, data: [] };
    groups[r.code].data.push([r.collected_at, parseFloat(r.balance)]);
  }
  const palette = ['#00d4ff', '#00ff88', '#ffcc00', '#ff3366', '#a78bfa', '#fb923c'];
  const series = Object.values(groups).map((g, i) => ({
    name: g.name,
    type: 'line',
    smooth: true,
    symbol: 'circle',
    symbolSize: 4,
    data: g.data.sort((a, b) => new Date(a[0]) - new Date(b[0])),
    lineStyle: { color: palette[i % palette.length], width: 2 },
    itemStyle: { color: palette[i % palette.length] },
  }));
  trendChart.setOption({
    backgroundColor: 'transparent',
    color: palette,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15,22,38,0.95)',
      borderColor: '#00d4ff',
      textStyle: { color: '#e0f7ff' },
    },
    legend: { textStyle: { color: '#7a8fa6', fontSize: 11 }, top: 2, type: 'scroll' },
    grid: { left: 52, right: 18, top: 32, bottom: 28 },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: '#1a3a5c' } },
      axisLabel: { color: '#5a7a9a', fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#1a3a5c' } },
      axisLabel: { color: '#5a7a9a', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(0,212,255,0.06)' } },
    },
    series,
  }, true);
}

// 根据平台余额更新雷达图光点
function updateRadar(platforms) {
  if (!window.radarScan) return;
  const n = platforms.length;
  const pts = platforms.map((p, i) => {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    let distRatio;
    if (p.balance == null || !p.is_configured) {
      distRatio = 0.25;
    } else {
      const ref = (p.yellow_threshold || 500) * 2.5;
      distRatio = Math.min(1, Math.max(0.18, p.balance / ref));
    }
    return {
      angle,
      dist: window.radarScan.r * distRatio,
      color: H.levelColor(p.level),
      name: H.iconOf(p.code),
    };
  });
  window.radarScan.setPoints(pts);
}
