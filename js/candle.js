/* Свеча на canvas: пламя с ореолом, дымок у погасшего фитиля
   и чётки-мала по кругу — каждая бусина = одно повторение мантры. */
function Candle(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const st = { lit: !!opts.lit, fire: opts.lit ? 1 : 0, total: 0, done: 0 };
  let w = 0, h = 0;
  const t0 = performance.now();

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // мягкий псевдошум для мерцания
  const wob = (t, s) => Math.sin(t * 1.7 + s) * 0.5 + Math.sin(t * 3.1 + s * 2.3) * 0.3 + Math.sin(t * 7.3 + s * 0.7) * 0.2;

  function flamePath(x, y, fh, fw, sway) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x - fw, y - fh * 0.2, x - fw * 0.7 + sway * 0.4, y - fh * 0.65, x + sway, y - fh);
    ctx.bezierCurveTo(x + fw * 0.7 + sway * 0.4, y - fh * 0.65, x + fw, y - fh * 0.2, x, y);
    ctx.closePath();
  }

  function frame(now) {
    const t = reduce ? 0 : (now - t0) / 1000;
    st.fire += ((st.lit ? 1 : 0) - st.fire) * (reduce ? 1 : 0.035);
    const f = st.fire;
    ctx.clearRect(0, 0, w, h);

    const s = Math.min(w, h) / 400;
    const cx = w / 2, cy = h / 2;
    const wickY = cy + 12 * s;

    // ореол
    if (f > 0.01) {
      const gr = 190 * s * (0.6 + 0.4 * f) * (1 + 0.04 * wob(t * 1.3, 2));
      const g = ctx.createRadialGradient(cx, wickY - 30 * s, 0, cx, wickY - 30 * s, gr);
      g.addColorStop(0, `rgba(240,168,74,${0.30 * f})`);
      g.addColorStop(0.45, `rgba(200,99,43,${0.10 * f})`);
      g.addColorStop(1, 'rgba(200,99,43,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // чётки: бусина-мера сверху, дальше по кругу
    if (st.total) {
      const R = Math.min(w, h) / 2 - 14 * s;
      const n = st.total;
      const br = n > 54 ? 2.6 * s : n > 27 ? 3.6 * s : 5 * s;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + ((i + 1) / (n + 1)) * Math.PI * 2;
        const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        ctx.beginPath();
        ctx.arc(x, y, br, 0, Math.PI * 2);
        if (i < st.done) {
          ctx.fillStyle = `rgba(240,168,74,${0.55 + 0.45 * Math.max(f, 0.4)})`;
          ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(237,228,207,0.07)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(237,228,207,0.28)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      ctx.beginPath();
      ctx.arc(cx, cy - R, br * 1.9, 0, Math.PI * 2);
      ctx.fillStyle = st.done >= n ? '#F0A84A' : 'rgba(142,136,200,0.55)';
      ctx.fill();
    }

    // тело свечи
    const cw = 58 * s, ch = 150 * s, top = wickY + 4 * s;
    const body = ctx.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0);
    body.addColorStop(0, '#6f6553');
    body.addColorStop(0.35, '#e6dbc2');
    body.addColorStop(0.6, '#d8cbad');
    body.addColorStop(1, '#5d5446');
    ctx.fillStyle = body;
    ctx.fillRect(cx - cw / 2, top, cw, ch);
    // подсветка воска у фитиля
    const wax = ctx.createLinearGradient(0, top, 0, top + 60 * s);
    wax.addColorStop(0, `rgba(255,190,110,${0.45 * f})`);
    wax.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = wax;
    ctx.fillRect(cx - cw / 2, top, cw, 60 * s);
    ctx.beginPath();
    ctx.ellipse(cx, top, cw / 2, 6 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = f > 0.05 ? `rgba(245,220,170,${0.6 + 0.4 * f})` : '#cfc2a4';
    ctx.fill();
    // мягкое затемнение к низу
    const fade = ctx.createLinearGradient(0, top + ch * 0.4, 0, top + ch);
    fade.addColorStop(0, 'rgba(12,11,18,0)');
    fade.addColorStop(1, 'rgba(12,11,18,0.9)');
    ctx.fillStyle = fade;
    ctx.fillRect(cx - cw / 2 - 1, top + ch * 0.4, cw + 2, ch * 0.6 + 1);

    // фитиль
    ctx.strokeStyle = '#2a2320';
    ctx.lineWidth = 2.2 * s;
    ctx.beginPath();
    ctx.moveTo(cx, top + 2 * s);
    ctx.quadraticCurveTo(cx + 1.5 * s, wickY - 4 * s, cx + 0.5 * s, wickY - 9 * s);
    ctx.stroke();

    if (f > 0.01) {
      const fh = 84 * s * f * (1 + 0.07 * wob(t, 1));
      const fw = 14 * s * (0.5 + 0.5 * f) * (1 + 0.05 * wob(t * 1.2, 3));
      const sway = 4 * s * wob(t * 0.7, 5);
      const baseY = wickY - 2 * s;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const og = ctx.createLinearGradient(0, baseY, 0, baseY - fh);
      og.addColorStop(0, 'rgba(90,110,230,0.55)');
      og.addColorStop(0.14, 'rgba(255,150,60,0.85)');
      og.addColorStop(0.6, 'rgba(255,196,110,0.8)');
      og.addColorStop(1, 'rgba(255,230,170,0)');
      ctx.fillStyle = og;
      flamePath(cx, baseY, fh, fw, sway);
      ctx.fill();
      const ig = ctx.createLinearGradient(0, baseY, 0, baseY - fh * 0.6);
      ig.addColorStop(0, 'rgba(255,255,240,0.2)');
      ig.addColorStop(0.3, 'rgba(255,248,220,0.95)');
      ig.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = ig;
      flamePath(cx, baseY - 4 * s, fh * 0.58, fw * 0.45, sway * 0.6);
      ctx.fill();
      ctx.restore();
    }

    // дымок, пока свеча не горит
    if (f < 0.6 && !reduce) {
      ctx.save();
      ctx.strokeStyle = `rgba(200,195,215,${0.22 * (1 - f / 0.6)})`;
      ctx.lineWidth = 1.4 * s;
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const p = i / 40;
          const x = cx + Math.sin(p * 6 + t * 1.4 + k * 2) * 9 * s * p + k * 3 * s;
          const y = wickY - 10 * s - p * 110 * s;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(frame);

  return {
    setLit(v) { st.lit = v; },
    setBeads(total, done) { st.total = total; st.done = done; },
  };
}
