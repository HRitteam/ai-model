// 雷达扫描动画（Canvas）：同心圆 + 旋转扫描扇形 + 平台光点
// 配色：GitHub Dark 蓝色系
const RADAR_COLORS = {
  ring:        'rgba(74,144,217,0.12)',      /* 同心圆 */
  cross:       'rgba(74,144,217,0.2)',       /* 十字线 */
  sweepAlpha:  [0.06, 0.10, 0.14, 0.18, 0.22],   /* 扫描扇形渐变透明度 */
  sweepLine:   'rgba(74,144,217,0.85)',     /* 扫描亮线 */
  centerDot:   'rgba(74,144,217,0.5)',       /* 中心点 */
  labelColor:  'rgba(230,237,243,0.7)',     /* 平台标签文字 */
  // 状态色
  normal:      '#3FB950',
  yellow:      '#D4A843',
  red:         '#FF4444',
  unconfigured:'#555F6D',
};

class RadarScan {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.angle = 0;
    this.points = [];
    this.running = false;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = rect.width;
    this.h = rect.height;
    this.cx = this.w / 2;
    this.cy = this.h / 2;
    this.r = Math.max(20, Math.min(this.w, this.h) / 2 - 14);
  }

  setPoints(points) { this.points = points || []; }

  start() {
    if (this.running) return;
    this.running = true;
    this.loop();
  }

  loop() {
    if (!this.running) return;
    this.draw();
    this.angle += 0.018;
    if (this.angle > Math.PI * 2) this.angle -= Math.PI * 2;
    requestAnimationFrame(() => this.loop());
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    // 同心圆（蓝色系）
    ctx.strokeStyle = RADAR_COLORS.ring;
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, (this.r * i) / 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 十字线
    ctx.strokeStyle = RADAR_COLORS.cross;
    ctx.beginPath();
    ctx.moveTo(this.cx - this.r, this.cy); ctx.lineTo(this.cx + this.r, this.cy);
    ctx.moveTo(this.cx, this.cy - this.r); ctx.lineTo(this.cx, this.cy + this.r);
    ctx.stroke();

    // 扫描扇形（拖尾渐变）
    const sectors = 36;
    const sweepTotal = Math.PI / 2.2;
    for (let i = 0; i < sectors; i++) {
      const a0 = this.angle - sweepTotal + (sweepTotal * i / sectors);
      const a1 = this.angle - sweepTotal + (sweepTotal * (i + 1) / sectors);
      const alpha = RADAR_COLORS.sweepAlpha[i] || 0.28;
      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy);
      ctx.arc(this.cx, this.cy, this.r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = `rgba(74,144,217,${alpha})`;
      ctx.fill();
    }
    // 扫描线（亮线）
    ctx.strokeStyle = RADAR_COLORS.sweepLine;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.cx, this.cy);
    ctx.lineTo(this.cx + Math.cos(this.angle) * this.r, this.cy + Math.sin(this.angle) * this.r);
    ctx.stroke();

    // 中心点
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = RADAR_COLORS.centerDot;
    ctx.fill();

    // 平台光点
    for (const p of this.points) {
      const x = this.cx + Math.cos(p.angle) * p.dist;
      const y = this.cy + Math.sin(p.angle) * p.dist;
      // 扫描线扫过时高亮
      let diff = Math.abs(this.angle - p.angle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      const lit = diff < 0.25;

      // 根据状态选颜色
      let color = RADAR_COLORS.unconfigured;
      if (p.level === 'normal') color = RADAR_COLORS.normal;
      else if (p.level === 'yellow') color = RADAR_COLORS.yellow;
      else if (p.level === 'red') color = RADAR_COLORS.red;

      ctx.beginPath();
      ctx.arc(x, y, lit ? 7 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      if (lit) {
        ctx.shadowBlur = 16;
        ctx.shadowColor = color;
      } else {
        ctx.shadowBlur = 6;
        ctx.shadowColor = color;
      }
      ctx.fill();
      ctx.shadowBlur = 0;

      // 标签
      ctx.fillStyle = RADAR_COLORS.labelColor;
      ctx.font = '10px "Microsoft YaHei", "PingFang SC", sans-serif';
      ctx.fillText(p.name, x + 10, y + 4);
    }
  }
}

function startRadar() {
  const canvas = document.getElementById('radarCanvas');
  if (!canvas) return;
  window.radarScan = new RadarScan(canvas);
  window.radarScan.start();
}
