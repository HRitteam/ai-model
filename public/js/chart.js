// ECharts 折线图 + 雷达点更新
let trendChart = null;

function initTrendChart() {
  const el = document.getElementById('trendChart');
  if (!el || typeof echarts === 'undefined') return;
  trendChart = echarts.init(el);
  window.addEventListener('resize', () => trendChart && trendChart.resize());
}

function compactTrendPoints(points, maxPoints = 24) {
  if (points.length <= maxPoints) return points;

  const sorted = points.slice().sort((a, b) => new Date(a[0]) - new Date(b[0]));
  const bucketSize = Math.ceil(sorted.length / maxPoints);
  const compacted = [sorted[0]];

  for (let i = 1; i < sorted.length - 1; i += bucketSize) {
    const bucket = sorted.slice(i, Math.min(i + bucketSize, sorted.length - 1));
    if (!bucket.length) continue;
    const previous = compacted[compacted.length - 1][1];
    const representative = bucket.reduce((best, point) => {
      return Math.abs(point[1] - previous) > Math.abs(best[1] - previous) ? point : best;
    }, bucket[bucket.length - 1]);
    compacted.push(representative);
  }

  const last = sorted[sorted.length - 1];
  if (compacted[compacted.length - 1][0] !== last[0]) compacted.push(last);
  return compacted;
}

function renderTrend(rows) {
  if (!trendChart || !rows) return;
  const groups = {};
  for (const r of rows) {
    if (!groups[r.code]) groups[r.code] = { name: r.name, data: [] };
    groups[r.code].data.push([r.collected_at, parseFloat(r.balance)]);
  }
  const palette = ['#4A90D9', '#3FB950', '#D4A843', '#FF4444', '#F0883E', '#39D2C0'];
  const series = Object.values(groups).map((g, i) => ({
    name: g.name,
    type: 'line',
    smooth: true,
    showSymbol: false,
    symbol: 'circle',
    symbolSize: 7,
    sampling: 'lttb',
    data: compactTrendPoints(g.data),
    lineStyle: { color: palette[i % palette.length], width: 2 },
    itemStyle: { color: palette[i % palette.length] },
    emphasis: {
      focus: 'series',
      lineStyle: { width: 3 },
      itemStyle: { color: palette[i % palette.length] },
    },
  }));
  trendChart.setOption({
    backgroundColor: 'transparent',
    color: palette,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(22,27,34,0.95)',
      borderColor: 'rgba(74,144,217,0.4)',
      textStyle: { color: '#E6EDF3' },
    },
    legend: { textStyle: { color: '#8B949E', fontSize: 11 }, top: 0, type: 'scroll' },
    grid: { left: 44, right: 12, top: 28, bottom: 18 },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: 'rgba(74,144,217,0.2)' } },
      axisLabel: { color: '#555F6D', fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(74,144,217,0.2)' } },
      axisLabel: { color: '#555F6D', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(74,144,217,0.06)' } },
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
      distRatio = 0.22;
    } else {
      const ref = (p.yellow_threshold || 500) * 2.5;
      distRatio = Math.min(0.84, Math.max(0.2, p.balance / ref));
    }
    return {
      angle,
      dist: window.radarScan.r * distRatio,
      level: p.level,                      /* 供 scan.js 按状态着色 */
      color: H.levelColor(p.level),
      name: p.name || H.iconOf(p.code),
    };
  });
  window.radarScan.setPoints(pts);
}
