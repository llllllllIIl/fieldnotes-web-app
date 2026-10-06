// canvas bg, off when reduced motion is on
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.getElementById("bg");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let w, h, t = 0;
  const pulses = Array.from({ length: 26 }, () => ({
    x: Math.random(), y: Math.random(),
    s: 0.0006 + Math.random() * 0.0022,
    c: Math.random() < 0.6 ? "129,216,208" : "255,126,179",
    r: 1 + Math.random() * 2.2
  }));

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  function frame() {
    t += 0.008;
    ctx.fillStyle = "#040404";
    ctx.fillRect(0, 0, w, h);

    // perspective grid
    ctx.strokeStyle = "rgba(123,175,212,0.12)";
    ctx.lineWidth = 1;
    const horizon = h * 0.42;
    for (let i = 0; i <= 24; i++) {
      const x = (i / 24) * w;
      ctx.beginPath();
      ctx.moveTo(w / 2 + (x - w / 2) * 0.25, horizon);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const p = ((i / 12) + (t * 0.25) % 1) % 1;
      const y = horizon + Math.pow(p, 1.8) * (h - horizon);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // traveling pulses
    for (const p of pulses) {
      p.y -= p.s;
      if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
      const x = p.x * w, y = p.y * h;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 26);
      g.addColorStop(0, `rgba(${p.c},0.85)`);
      g.addColorStop(1, `rgba(${p.c},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${p.c},1)`;
      ctx.beginPath();
      ctx.arc(x, y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(frame);
  }
  frame();
})();
