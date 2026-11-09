/* =========================
   IDLE SCREENSAVER (DVD logo)
   After a few minutes without any activity, the screen goes dark and the three-bar logo
   bounces around the window like the old DVD player screensaver. Move the mouse (or touch,
   click, press a key, scroll) and the site comes back exactly where you left it.

   Own file on purpose: it only adds its own overlay, it never touches the real logo,
   the intro animation or the scrolling.

   Quick test: open the site with ?idle=5 at the end of the address (starts after 5 seconds).
========================= */

(() => {
  const IDLE_MINUTES = 4;                       // change this: anything from 3 to 5 feels right
  const SPEED = 170;                            // pixels per second
  const COLORS = ["#f4f4f4", "#e0562c", "#cbc9bb", "#7fb7a4", "#e6c35c", "#8f9bd9"];

  const test = parseFloat(new URLSearchParams(location.search).get("idle"));
  const IDLE_MS = test > 0 ? test * 1000 : IDLE_MINUTES * 60 * 1000;

  // same shape as the real logo (bars 130 / 130 / 161 wide, 22 tall, inside a 208 wide box)
  const css = document.createElement("style");
  css.textContent = `
  .idle { position: fixed; inset: 0; z-index: 20000; background: #0b0b0b; overflow: hidden;
          opacity: 0; transition: opacity .6s ease; cursor: none; }
  .idle.on { opacity: 1; }
  .idle-logo { position: absolute; left: 0; top: 0; display: flex; flex-direction: column; gap: 7px; width: 208px;
          transform-origin: left top; will-change: transform; color: #f4f4f4; transition: color .25s; }
  .idle-logo i { display: block; height: 22px; background: currentColor; }
  .idle-logo i:nth-child(1) { align-self: center;     width: 130px; }
  .idle-logo i:nth-child(2) { align-self: flex-start; width: 130px; }
  .idle-logo i:nth-child(3) { align-self: flex-end;   width: 161px; }
  `;
  document.head.append(css);

  const W0 = 208, H0 = 22 * 3 + 7 * 2;          // logo size at scale 1
  let overlay = null, logo = null, raf = 0;
  let x = 0, y = 0, vx = 1, vy = 1, ci = 0, last = 0, scale = 1, w = W0, h = H0;
  let shownAt = 0, timer = 0, lastMX = -1, lastMY = -1;

  const measure = () => {
    scale = Math.min(1.25, (innerWidth - 40) / W0);
    w = W0 * scale; h = H0 * scale;
  };

  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    x += vx * SPEED * dt; y += vy * SPEED * dt;
    let hitX = false, hitY = false;
    const maxX = innerWidth - w, maxY = innerHeight - h;
    if (x <= 0)    { x = 0;    vx =  1; hitX = true; }
    if (x >= maxX) { x = maxX; vx = -1; hitX = true; }
    if (y <= 0)    { y = 0;    vy =  1; hitY = true; }
    if (y >= maxY) { y = maxY; vy = -1; hitY = true; }
    if (hitX || hitY) { ci = (ci + 1) % COLORS.length; logo.style.color = COLORS[ci]; }   // new colour on every bounce
    logo.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0) scale(" + scale + ")";
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (overlay) return;
    measure();
    overlay = document.createElement("div");
    overlay.className = "idle";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = '<div class="idle-logo"><i></i><i></i><i></i></div>';
    document.body.append(overlay);
    logo = overlay.firstChild;
    x = Math.random() * Math.max(1, innerWidth - w);
    y = Math.random() * Math.max(1, innerHeight - h);
    vx = Math.random() < 0.5 ? -1 : 1; vy = Math.random() < 0.5 ? -1 : 1;
    ci = 0; logo.style.color = COLORS[0];
    lastMX = lastMY = -1;
    shownAt = performance.now();
    last = shownAt;
    raf = requestAnimationFrame(tick);
    requestAnimationFrame(() => requestAnimationFrame(() => overlay && overlay.classList.add("on")));
  }

  function stop() {
    if (!overlay) return;
    cancelAnimationFrame(raf);
    const o = overlay; overlay = null; logo = null;
    o.classList.remove("on");
    setTimeout(() => o.remove(), 650);
  }

  function arm() {
    clearTimeout(timer);
    timer = setTimeout(start, IDLE_MS);
  }

  // Browsers fire "fake" mousemove events (same position) whenever something animates under a still cursor, and the
  // page has animation running all the time. Those must NOT count as activity, so only real movement does.
  const debug = new URLSearchParams(location.search).has("idledebug");
  let px = null, py = null, sy = window.scrollY;
  const seen = why => { window.__idleLast = why + " @ " + new Date().toLocaleTimeString(); if (debug) console.log("[idle] activity:", why); };

  const isReal = e => {
    if (e.type === "mousemove" || e.type === "pointermove") {
      if (px === null) { px = e.clientX; py = e.clientY; return false; }           // first one only gives a starting point
      const d = Math.abs(e.clientX - px) + Math.abs(e.clientY - py);
      if (d < 4) return false;                                                     // same spot / tiny tremor: not activity
      px = e.clientX; py = e.clientY;
      return true;
    }
    if (e.type === "scroll") {                                                     // only if the page really moved
      const moved = Math.abs(window.scrollY - sy) > 1; sy = window.scrollY; return moved;
    }
    return true;                                                                   // click, touch, key, wheel
  };

  function activity(e) {
    if (!isReal(e)) return;
    if (overlay) {
      if (performance.now() - shownAt < 400) return;                               // ignore the jitter right as it appears
      stop();
    }
    seen(e.type);
    arm();
  }

  ["mousemove", "mousedown", "pointerdown", "touchstart", "keydown", "wheel", "scroll"].forEach(ev =>
    window.addEventListener(ev, activity, { passive: true, capture: true }));

  window.addEventListener("resize", () => { if (overlay) measure(); });

  // a hidden tab is not "looking at the site": restart the countdown when it comes back
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { if (overlay) stop(); arm(); } });

  arm();
  if (debug) console.log("[idle] ready, screensaver after", IDLE_MS / 1000, "seconds without activity");
})();
