// 六宫格卡片渲染
function renderGrid(platforms) {
  const left = document.getElementById('gridLeft');
  const right = document.getElementById('gridRight');
  left.innerHTML = '';
  right.innerHTML = '';
  platforms.forEach((p, i) => {
    const card = buildCard(p);
    (i % 2 === 0 ? left : right).appendChild(card);
  });
}

function statusBadgeHtml(p) {
  // 有采集数据时按余额级别显示徽章（凭证未配置不掩盖级别）
  if (p.status === 'ok' && p.balance != null) {
    const map = { normal: ['badge-ok', '正常'], yellow: ['badge-warn', '预警'], red: ['badge-danger', '告警'], unknown: ['badge-gray', '--'] };
    const [cls, txt] = map[p.level] || map.unknown;
    return `<span class="card-badge ${cls}">${txt}</span>`;
  }
  if (p.status === 'cookie_expired') return `<span class="card-badge badge-gray">Cookie过期</span>`;
  if (p.status === 'error') return `<span class="card-badge badge-gray">采集异常</span>`;
  if (!p.is_configured) return `<span class="card-badge badge-gray">未配置</span>`;
  return `<span class="card-badge badge-gray">--</span>`;
}

function buildCard(p) {
  const card = document.createElement('div');
  card.className = `grid-card level-${p.level || 'unknown'}`;
  const bal = p.balance != null ? H.formatNum(p.balance) : '--';
  const balClass = `t-${p.level || 'unknown'}`;
  const spark = (p.trend7d && p.trend7d.length) ? `<div class="card-spark" id="spark-${p.code}"></div>` : '<div class="card-spark"></div>';
  let foot;
  if (p.status === 'cookie_expired') {
    foot = `<span class="err">⚠ Cookie已过期</span>`;
  } else if (p.status === 'error') {
    foot = `<span class="err">⚠ 采集异常</span>`;
  } else if (p.status === 'ok') {
    const cfgHint = p.is_configured ? '' : ' · <span class="err">凭证未配置</span>';
    foot = `<span>采集: ${H.fmtTime(p.last_collected_at)}</span><span>阈值: ${H.formatNum(p.yellow_threshold)}/${H.formatNum(p.red_threshold)}${cfgHint}</span>`;
  } else {
    foot = `<span class="err">○ 未配置凭证</span>`;
  }
  card.innerHTML = `
    <div class="card-head">
      <div class="card-name"><span class="picon">${H.iconOf(p.code)}</span>${p.name}</div>
      ${statusBadgeHtml(p)}
    </div>
    <div class="card-balance">
      <span class="balance-num ${balClass}">${bal}</span>
      <span class="balance-unit">${p.currency || ''}</span>
    </div>
    ${spark}
    <div class="card-foot">${foot}</div>
  `;
  if (p.trend7d && p.trend7d.length) {
    setTimeout(() => drawSpark(`spark-${p.code}`, p.trend7d, p.level), 10);
  }
  return card;
}

function drawSpark(id, trend, level) {
  const el = document.getElementById(id);
  if (!el || typeof echarts === 'undefined') return;
  const ch = echarts.init(el);
  const color = H.levelColor(level);
  ch.setOption({
    grid: { left: 0, right: 0, top: 2, bottom: 2 },
    xAxis: { type: 'category', show: false, data: trend.map(t => t.collected_at) },
    yAxis: { type: 'value', show: false },
    series: [{
      type: 'line', smooth: true, symbol: 'none',
      data: trend.map(t => parseFloat(t.balance)),
      lineStyle: { color }, areaStyle: { color, opacity: 0.15 },
    }],
  });
}
