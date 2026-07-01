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

function isQueryOnlyCard(p) {
  return p.code === 'zhipu' || p.code === 'minimax';
}

function statusBadgeHtml(p) {
  if (p.status === 'ok' && p.balance != null) {
    const map = {
      normal: ['badge-ok', '正常'],
      yellow: ['badge-warn', '预警'],
      red: ['badge-danger', '告警'],
      unknown: ['badge-gray', '--'],
    };
    const [cls, txt] = map[p.level] || map.unknown;
    return `<span class="card-badge ${cls}">${txt}</span>`;
  }
  if (p.status === 'cookie_expired') return `<span class="card-badge badge-gray">Cookie过期</span>`;
  if (p.status === 'error') return `<span class="card-badge badge-gray">采集异常</span>`;
  if (!p.is_configured) return `<span class="card-badge badge-gray">未配置</span>`;
  return `<span class="card-badge badge-gray">--</span>`;
}

function buildCardAction(p) {
  if (isQueryOnlyCard(p) && p.balance_query_url) {
    return `<a class="card-action-btn" href="${p.balance_query_url}" target="_blank" rel="noreferrer">查询余额</a>`;
  }
  return statusBadgeHtml(p);
}

function buildCardFoot(p) {
  if (p.collect_type === 'manual' && p.balance_query_url) {
    return `<span>支持官网手动核对余额</span><span>阈值: ${H.formatNum(p.yellow_threshold)}/${H.formatNum(p.red_threshold)}</span>`;
  }
  if (p.status === 'cookie_expired') {
    return `<span class="err">⚠ Cookie已过期</span>`;
  }
  if (p.status === 'error') {
    return `<span class="err">⚠ 采集异常</span>`;
  }
  if (p.status === 'ok') {
    const cfgHint = p.is_configured ? '' : ' · <span class="err">凭证未配置</span>';
    return `<span>采集: ${H.fmtTime(p.last_collected_at)}</span><span>阈值: ${H.formatNum(p.yellow_threshold)}/${H.formatNum(p.red_threshold)}${cfgHint}</span>`;
  }
  return `<span class="err">● 未配置凭证</span>`;
}

function buildCard(p) {
  const queryOnly = isQueryOnlyCard(p);
  const card = document.createElement('div');
  card.className = `grid-card level-${p.level || 'unknown'}${queryOnly ? ' query-only-card' : ''}`;

  const bal = p.balance != null ? H.formatNum(p.balance) : '--';
  const balClass = `t-${p.level || 'unknown'}`;
  const spark = (p.trend7d && p.trend7d.length)
    ? `<div class="card-spark" id="spark-${p.code}"></div>`
    : '<div class="card-spark"></div>';

  card.innerHTML = `
    <div class="card-head">
      <div class="card-title-block">
        <div class="card-name">
          <img class="picon-img" src="${H.iconUrl(p.code)}" onerror="this.style.display='none';this.nextElementSibling.style.display='inline';"/>
          <span class="picon-fallback" style="display:none">${H.iconOf(p.code)}</span>
          ${p.name}
        </div>
      </div>
      ${buildCardAction(p)}
    </div>
    ${queryOnly ? '' : `
      <div class="card-balance">
        <span class="balance-num ${balClass}">${bal}</span>
        <span class="balance-unit">${p.currency || ''}</span>
      </div>
      ${spark}
      <div class="card-foot">${buildCardFoot(p)}</div>
    `}
  `;

  if (!queryOnly && p.trend7d && p.trend7d.length) {
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
    grid: { left: 6, right: 6, top: 6, bottom: 6 },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: 'rgba(12,18,30,0.96)',
      borderColor: 'rgba(74,144,217,0.35)',
      textStyle: { color: '#E6EDF3', fontSize: 11 },
      formatter(params) {
        const point = Array.isArray(params) ? params[0] : params;
        if (!point) return '';
        const data = trend[point.dataIndex];
        return `${H.fmtTime(data.collected_at)}<br/>余额: ${H.formatNum(data.balance)}`;
      },
    },
    xAxis: { type: 'category', show: false, data: trend.map(t => t.collected_at) },
    yAxis: { type: 'value', show: false },
    series: [{
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      data: trend.map(t => parseFloat(t.balance)),
      lineStyle: { color },
      itemStyle: { color },
      emphasis: {
        itemStyle: { color },
      },
      areaStyle: { color, opacity: 0.15 },
    }],
  });
}
