// 雷达扫描动画（Canvas）：同心圆 + 旋转扫描扇形 + 平台光点
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

    // 同心圆
    ctx.strokeStyle = 'rgba(0,212,255,0.15)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, (this.r * i) / 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 十字线
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
      const alpha = (i / sectors) * 0.28;
      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy);
      ctx.arc(this.cx, this.cy, this.r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = `rgba(0,212,255,${alpha})`;
      ctx.fill();
    }
    // 扫描线（亮线）
    ctx.strokeStyle = 'rgba(0,212,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.cx, this.cy);
    ctx.lineTo(this.cx + Math.cos(this.angle) * this.r, this.cy + Math.sin(this.angle) * this.r);
    ctx.stroke();

    // 中心点
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,212,255,0.6)';
    ctx.fill();

    // 平台光点
    for (const p of this.points) {
      const x = this.cx + Math.cos(p.angle) * p.dist;
      const y = this.cy + Math.sin(p.angle) * p.dist;
      // 扫描线扫过时高亮
      let diff = Math.abs(this.angle - p.angle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      const lit = diff < 0.25;
      ctx.beginPath();
      ctx.arc(x, y, lit ? 6 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = lit ? 14 : 5;
      ctx.shadowColor = p.color;
      ctx.fill();
      ctx.shadowBlur = 0;
      // 标签
      ctx.fillStyle = 'rgba(224,247,255,0.75)';
      ctx.font = '10px monospace';
      ctx.fillText(p.name, x + 8, y + 3);
    }
  }
}

function startRadar() {
  const canvas = document.getElementById('radarCanvas');
  if (!canvas) return;
  window.radarScan = new RadarScan(canvas);
  window.radarScan.start();
}
