// ECharts 折线图 + 雷达点更新
let trendChart = null;

function initTrendChart() {
  const el = document.getElementById('trendChart');
  if (!el || typeof echarts === 'undefined') return;
  trendChart = echarts.init(el);
  window.addEventListener('resize', () => trendChart && trendChart.resize());
}

function normalizeChartTime(value) {
  if (!value) return value;
  if (value instanceof Date) return value;
  const text = String(value);
  const match = text.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+([+-])(\d{2})(\d{2})(?:\s+[A-Z]+)?$/);
  if (match) {
    return `${match[1]}T${match[2]}${match[3]}${match[4]}:${match[5]}`;
  }
  return text.replace(' ', 'T');
}

function chartTimeValue(value) {
  const normalized = normalizeChartTime(value);
  const ts = new Date(normalized).getTime();
  return Number.isFinite(ts) ? ts : value;
}

function renderTrend(rows) {
  if (!trendChart) initTrendChart();
  if (!trendChart || !rows) return;
  const groups = {};
  for (const r of rows) {
    if (!groups[r.code]) groups[r.code] = { name: r.name, data: [] };
    const timeValue = chartTimeValue(r.collected_at);
    const balance = parseFloat(r.balance);
    if (timeValue && Number.isFinite(balance)) {
      groups[r.code].data.push({
        time: timeValue,
        rawTime: r.collected_at,
        value: balance,
      });
    }
  }
  const palette = ['#4A90D9', '#3FB950', '#D4A843', '#FF4444', '#F0883E', '#39D2C0'];
  const maxPoints = Math.max(0, ...Object.values(groups).map(g => g.data.length));
  const categories = Array.from({ length: maxPoints }, (_, i) => `第${i + 1}次`);
  const series = Object.values(groups).map((g, i) => ({
    name: g.name,
    type: 'line',
    smooth: true,
    symbol: 'circle',
    symbolSize: 4,
    data: g.data
      .sort((a, b) => a.time - b.time)
      .map(point => ({
        value: point.value,
        collected_at: point.rawTime,
      })),
    lineStyle: { color: palette[i % palette.length], width: 2 },
    itemStyle: { color: palette[i % palette.length] },
  }));
  window.__trendDebug = {
    inputRows: rows.length,
    seriesCount: series.length,
    dataCounts: series.map(s => ({ name: s.name, count: s.data.length })),
  };
  trendChart.setOption({
    backgroundColor: 'transparent',
    color: palette,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(22,27,34,0.95)',
      borderColor: 'rgba(74,144,217,0.4)',
      textStyle: { color: '#E6EDF3' },
      formatter(params) {
        const list = Array.isArray(params) ? params : [params];
        return list.map(item => {
          const time = item.data && item.data.collected_at ? H.fmtTime(item.data.collected_at) : item.name;
          return `${item.marker}${item.seriesName}<br/>${time} 余额: ${H.formatNum(item.value)}`;
        }).join('<br/>');
      },
    },
    legend: { textStyle: { color: '#8B949E', fontSize: 11 }, top: 0, type: 'scroll' },
    grid: { left: 44, right: 12, top: 28, bottom: 18 },
    xAxis: {
      type: 'category',
      data: categories,
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
