
/* =========================
   SELECT ELEMENTS
========================= */

const loader = document.querySelector("#loader");
const website = document.querySelector("#website");

const logo = document.querySelector(".loader-logo");
const bars = document.querySelectorAll(".loader-logo .bar");
const cornerMark = document.querySelector("#pixelLoader");

// little angles the sheets arrive with, then settle flat
const TILTS = gsap.utils.wrap([-5, 4, -3, 6, -4, 3, -6, 5, -2]);
gsap.set(".card", { transformOrigin: "50% 0%" });


/* =========================
   PIXEL LOADER (BOTTOM LEFT)
========================= */

const pixelFrames = [
`.......
.#...#.
.......
.......
.......
.#...#.
.......`,
`#.....#
.#...#.
..#.#..
.......
..#.#..
.#...#.
#.....#`,
`.##.##.
##...##
#.....#
.......
#.....#
##...##
.##.##.`,
`..#.#..
.#...#.
#.....#
.......
#.....#
.#...#.
..#.#..`
].map(f => f.split("\n").join(""));

for (let i = 0; i < 49; i++) {
  cornerMark.appendChild(document.createElement("i"));
}

const pixelCells = [...cornerMark.children];
let pixelStep = 0;
let pixelTimer = null;

function drawPixelFrame() {
  pixelFrames[pixelStep].split("").forEach((c, i) => {
    pixelCells[i].classList.toggle("on", c === "#");
  });
}

function startPixelLoader() {
  drawPixelFrame();
  pixelTimer = setInterval(() => {
    pixelStep = (pixelStep + 1) % pixelFrames.length;
    drawPixelFrame();
  }, 380);
}

function stopPixelLoader() {
  clearInterval(pixelTimer);
}


/* =========================
   INITIAL SETTINGS
========================= */

gsap.set(website, {
  autoAlpha: 0
});

// New logo in the top-left corner (~290px wide on desktop)
const logoScale = Math.min(1.4, (window.innerWidth - 56) / 208);

gsap.set(logo, {
  transformOrigin: "left top",
  scale: logoScale * 0.85,
  opacity: 1
});

// Bars start off-screen on the right, then slide in right -> left
// Homepage logo: identical position + size to the finished loader logo
gsap.set(".site-logo", {
  transformOrigin: "left top",
  scale: logoScale
});

gsap.set(bars, {
  x: window.innerWidth / logoScale + 300
});

gsap.set(cornerMark, {
  opacity: 0
});


/* =========================
   LENIS SMOOTH SCROLL
========================= */

let lenis = null;

if (typeof Lenis !== "undefined") {

  lenis = new Lenis({
    duration: 1.5,                                   // glide length: heavy, but it must settle soon after you stop (1.9 kept sliding ~2s)
    easing: t => 1 - Math.pow(1 - t, 4),             // soft quartic ease-out: eases in gently, settles slowly (no sharp start)
    smoothWheel: true,
    wheelMultiplier: 0.7,                            // each wheel tick moves a little less: heavier
    touchMultiplier: 1.4
  });

  // fast flick = covers distance: slow scrolling keeps the heavy 0.7 feel; the harder / quicker the wheel is spun,
  // the more each notch travels (up to ~3x), so reaching the top or bottom does not take forever
  const BASE_WHEEL = 0.7;
  let wheelLog = [];
  window.addEventListener("wheel", e => {
    const now = performance.now();
    const px = Math.abs(e.deltaY) * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 600 : 1);
    wheelLog.push([now, px]);
    while (wheelLog.length && now - wheelLog[0][0] > 200) wheelLog.shift();
    const speed = wheelLog.reduce((t, w) => t + w[1], 0);               // px asked for in the last 200ms
    lenis.options.wheelMultiplier = BASE_WHEEL * (1 + Math.min(2, Math.max(0, (speed - 200) / 300)));
  }, { passive: true, capture: true });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }

  requestAnimationFrame(raf);
}


/* =========================
   LOADING ANIMATION
========================= */

function startLoader() {

  const timeline = gsap.timeline({
    defaults: {
      ease: "power3.out"
    },

    onComplete: () => {

      // Allow scrolling after loading
      document.body.style.overflow = "auto";
      document.body.classList.add("ready");
      initParallax();

      if (lenis) {
        lenis.start();
      }

      // Remove loader after animation
      stopPixelLoader();
      loader.style.display = "none";

    }
  });


  // 1. Pixel loader plays first (bottom-left)

  timeline.to(cornerMark, {
    opacity: 1,
    duration: 0.5,
    onStart: startPixelLoader
  });

  timeline.to({}, {
    duration: 1.2
  });


  // 2. Pixel loader drops down and out of view

  timeline.to(cornerMark, {
    y: 80,
    opacity: 0,
    duration: 0.45,
    ease: "power3.in",
    onComplete: stopPixelLoader
  });


  // 3. Then the bar logo slides in right -> left (top = center, middle = left, last = right)

  timeline.to(logo, {
    scale: logoScale,
    duration: 0.7
  });

  timeline.to(bars, {
    x: 0,
    duration: 0.8,
    stagger: 0.1,
    ease: "power4.out"
  }, "<");


  // Hold the finished logo

  timeline.to({}, {
    duration: 0.15
  });


  // 5. Prepare the homepage

  timeline.addLabel("home");

  timeline.set(website, {
    autoAlpha: 1
  });


  // 6. Reveal the homepage

  timeline.from(".nav-links, .nav-menu", {
    y: -25,
    opacity: 0,
    duration: 0.5,
    stagger: 0.08
  }, "home");


  // Paper sheets slide up into the stack, back to front
  timeline.fromTo(".thumb, .card, .emblem",
    { y: 120, opacity: 0, rotation: i => TILTS(i), scale: 0.96 },
    {
      y: 0,
      opacity: 1,
      rotation: 0,
      scale: 1,
      duration: 0.9,
      stagger: 0.12,
      ease: "power3.out"
    }, "home+=0.1");


  // 7. Fade the loader out - the homepage logo is already in the exact same spot

  timeline.to(loader, {
    autoAlpha: 0,
    duration: 0.4,
    ease: "power2.out"
  }, "home");


  return timeline;

}


/* =========================
   START IMMEDIATELY, SPEED UP WHEN ASSETS ARE READY
========================= */

document.body.style.overflow = "hidden";

if (lenis) {
  lenis.stop();
}

const SLOW_SPEED = 1;      // while assets are still loading
const FAST_SPEED = 1.4;    // once everything is rendered / loaded

const loaderTimeline = startLoader();
loaderTimeline.timeScale(SLOW_SPEED);

// owner login (login.js) is open: keep the intro on hold until the person logs in
if (window.__holdIntro) {
  loaderTimeline.pause();
  window.__resumeIntro = () => loaderTimeline.play();
}

const pageLoaded = new Promise(resolve => {
  if (document.readyState === "complete") {
    resolve();
  } else {
    window.addEventListener("load", resolve, { once: true });
  }
});

const fontsReady = document.fonts && document.fonts.ready
  ? document.fonts.ready
  : Promise.resolve();

Promise.all([pageLoaded, fontsReady]).then(() => {
  // Everything is loaded -> smoothly accelerate the loading animation
  gsap.to(loaderTimeline, {
    timeScale: FAST_SPEED,
    duration: 0.4,
    ease: "power2.out",
    overwrite: true
  });
});


/* =========================
   MOUSE PARALLAX (layers shift by depth)
========================= */

function initParallax() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cards = [...document.querySelectorAll("#stage > .card[data-depth]:not(.card-cream)")].map(el => ({
    d: parseFloat(el.dataset.depth),
    x: gsap.quickTo(el, "x", { duration: 0.8, ease: "power3.out" }),
    y: gsap.quickTo(el, "y", { duration: 0.8, ease: "power3.out" })
  }));

  window.addEventListener("mousemove", e => {
    if (window.__pageBusy) return;
    const nx = e.clientX / innerWidth - 0.5;
    const ny = e.clientY / innerHeight - 0.5;
    cards.forEach(c => { c.x(-nx * 14 * c.d); c.y(-ny * 10 * c.d); });
  });
}


/* =========================
   SCROLL: THE PAPER STACK
   The stage stays pinned. Every sheet slides up at its own speed and they
   all come to rest together (like the reference). The grey sheet moves 1:1
   with the scroll; the others are interpolated so they finish at the same time.
========================= */

const stage = document.querySelector("#stage");
const hero = document.querySelector(".hero");
const greySheet = document.querySelector(".card-grey");
const orangeSheet = document.querySelector(".card-orange");
const footBars = document.querySelector("#footBars");
const emblem = document.querySelector(".emblem");

// `end` = where the bottom edge of each sheet rests (fraction of the stage height)
const END_GREY = 0.49;
// the orange strip comes to rest with its bottom edge a little UNDER the small cream card (whose top rests at
// END_GREY - 0.30 = 0.19 of the stage height), so there is no black gap between them
const END_ORANGE = 0.20;
const scrollLayers = [
  { el: greySheet,                              end: END_GREY },
  { el: document.querySelector(".card-white"),  end: END_GREY },
  { el: orangeSheet,                            end: END_ORANGE },
  { el: document.querySelector(".card-cream"),  end: END_GREY },
  { el: document.querySelector(".thumbs"),      end: 0.47 }
];

let jeShift = 0;       // travel of the open entry's beige sheet
let scrollLength = 1;   // px of scrolling = distance the grey sheet travels
let stageH = 1;

function layoutScroll() {
  stageH = stage.clientHeight;

  // perforated strip is as long as the grey sheet, ending a bit higher
  const greyBottom = greySheet.offsetTop + greySheet.offsetHeight;
  orangeSheet.style.height =
    (greyBottom - (END_GREY - END_ORANGE) * stageH - orangeSheet.offsetTop) + "px";

  scrollLength = Math.max(1, greyBottom - END_GREY * stageH);
  // an open journal entry (the beige sheet) is one more sheet of the stack: the scroll is as long as it needs,
  // and every sheet comes to rest together with it
  const je = window.__jeLock && window.__jeSheetEl;
  jeShift = 0;
  if (je) {
    jeShift = Math.max(0, je.offsetTop + je.offsetHeight - END_GREY * stageH);   // how far the beige sheet must travel to rest like the others
    scrollLength = Math.max(scrollLength, jeShift);   // normally the default length, so every sheet moves exactly as it does without an entry open; only a very long entry stretches it
  }
  hero.style.height = (stageH + scrollLength) + "px";

  scrollLayers.forEach(l => {
    l.shift = l.el.offsetTop + l.el.offsetHeight - l.end * stageH;
  });

  updateScroll(true);
}

const clamp01 = v => Math.min(1, Math.max(0, v));

const logoEl = document.querySelector(".site-logo");
const navEl = document.querySelector(".navbar");
let lastY = -1, lastV = -1;

function updateScroll(force) {
  const y = window.scrollY;
  if (force !== true && y === lastY) return;       // Lenis + the native scroll event both call this: do the work once per position
  lastY = y;
  const p = clamp01(y / scrollLength);

  // sheets: individual `translate` property, so it stacks on top of GSAP's transform
  for (let i = 0; i < scrollLayers.length; i++) {
    const l = scrollLayers[i];
    l.el.style.translate = "0 " + (-l.shift * p).toFixed(2) + "px";
  }

  // the beige entry sheet is one more layer: it travels its own distance and comes to rest together with the others
  if (window.__jeLock && window.__jeSheetEl) window.__jeSheetEl.style.translate = "0 " + (-jeShift * p).toFixed(2) + "px";

  // logo + nav leave with the page
  const away = "0 " + (-y).toFixed(1) + "px";
  logoEl.style.translate = away;
  navEl.style.translate = away;

  // footer logo row fades/slides in over the last stretch, emblem makes room (only touched while it changes)
  const v = clamp01((p - 0.9) / 0.08);
  if (v !== lastV || v > 0) {
    lastV = v;
    footBars.style.setProperty("--v", v.toFixed(3));
    emblem.style.translate = "0 " + (-v * 0.13 * stageH).toFixed(1) + "px";
  }
  setFootSpread(p > 0.985 ? 1 : 0);
}

// the three bar groups drift apart once the end is reached (time based, eased)
const spread = { s: 0 };
let spreadTarget = 0;

function setFootSpread(target) {
  if (target === spreadTarget) return;
  spreadTarget = target;
  gsap.to(spread, {
    s: target,
    duration: target ? 2 : 0.6,
    ease: "power3.out",
    overwrite: true,
    onUpdate: () => footBars.style.setProperty("--s", spread.s.toFixed(4))
  });
}

// Lenis reports each smoothed step inside its own animation frame, so the sheets move in the SAME frame
// as the page (the native scroll event arrives a frame later, which is what felt laggy on fast flicks)
if (lenis) lenis.on("scroll", () => updateScroll());
window.addEventListener("scroll", () => updateScroll(), { passive: true });
window.addEventListener("resize", layoutScroll);
layoutScroll();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutScroll);
window.addEventListener("load", layoutScroll);


/* nav / in-page links -> positions inside the long sheet */

function sheetTarget(sel) {
  const el = document.querySelector(sel);
  return greySheet.offsetTop + el.offsetTop - 0.1 * stageH;
}

document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener("click", e => {
    const id = a.getAttribute("href");
    if (a.classList.contains("nav-menu")) return;   // Menu opens the overview (see MENU OVERVIEW)
    if (a.closest(".nav-links")) {
      const PAGE = { "#about": "about", "#books": "books", "#credits": "credits", "#contact": "contacts" };
      if (PAGE[id]) { e.preventDefault(); goToPage(PAGE[id]); return; }
    }
    if (a.classList.contains("contact-link")) { e.preventDefault(); return; }   // just opens the form
    let y = 0;
    if (id === "#stage") y = 0;
    else if (id === "#books") y = sheetTarget("#featured");
    else if (id === "#credits") y = sheetTarget("#authors");
    else if (id === "#contact") y = scrollLength;
    else if (id !== "#about" && id !== "#") return;

    e.preventDefault();
    if (lenis) lenis.scrollTo(y, { duration: 1.6 });
    else window.scrollTo({ top: y, behavior: "smooth" });
  });
});


/* =========================
   PIXEL DRAWING MODE
   Click the emblem (bottom right): the sheets fade out and the cursor leaves
   an orange pixel trail. Pen / eraser / download / clear on the right edge.
   The drawing stays behind the sheets afterwards, but resets on reload.
========================= */

(() => {
  const canvas = document.querySelector("#pixels");
  const ctx = canvas.getContext("2d");
  const emblemBtn = document.querySelector("#emblem");
  const toolbar = document.querySelector("#tools");
  const COLOR = "#e0562c";
  const KEY = "dw-pixel-drawing";
  const COLS = 200;                       // pixels across the screen

  let cells = new Set();
  let cell = 8;
  let tool = "pen";
  let last = null;
  let active = false;
  let saveTimer = null;

  // the drawing resets on every reload: wipe anything saved by older versions
  try { localStorage.removeItem(KEY); } catch (e) {}

  const rectFor = (x, y) => {
    const x0 = Math.floor(x * cell), y0 = Math.floor(y * cell);
    return [x0, y0, Math.floor((x + 1) * cell) - x0, Math.floor((y + 1) * cell) - y0];
  };

  function resize() {
    canvas.width = stage.clientWidth;
    canvas.height = stage.clientHeight;
    cell = Math.max(5, canvas.width / COLS);
    redraw();
  }

  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = COLOR;
    cells.forEach(k => {
      const [x, y] = k.split(",").map(Number);
      ctx.fillRect(...rectFor(x, y));
    });
  }

  function save() { /* drawing is not persisted: it resets when the page reloads */ }

  function paint(x, y, on) {
    const k = x + "," + y;
    if (on) {
      if (cells.has(k)) return;
      cells.add(k);
      ctx.fillStyle = COLOR;
      ctx.fillRect(...rectFor(x, y));
    } else {
      if (!cells.delete(k)) return;
      ctx.clearRect(...rectFor(x, y));
    }
  }

  // Bresenham, so fast mouse moves leave no gaps
  function line(x0, y0, x1, y1, on) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      paint(x0, y0, on);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  canvas.style.touchAction = "none";
  // block native page scroll while drawing (do not touch overflow: it would unpin the stage)
  canvas.addEventListener("wheel", e => { if (active) e.preventDefault(); }, { passive: false });

  canvas.addEventListener("pointermove", e => {
    if (!active) return;
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / cell);
    const y = Math.floor((e.clientY - r.top) / cell);
    const on = tool === "pen";
    if (last) line(last.x, last.y, x, y, on); else paint(x, y, on);
    last = { x, y };
    save();
  });
  canvas.addEventListener("pointerleave", () => { last = null; });

  function setMode(on) {
    active = on;
    last = null;
    document.body.classList.toggle("drawing", on);
    if (lenis) { on ? lenis.stop() : lenis.start(); }
    if (!on) {
      gsap.fromTo("#stage > .card, #stage .thumb",
        { rotation: i => TILTS(i) * 0.9, scale: 0.97 },
        { rotation: 0, scale: 1, duration: 1.1, stagger: 0.07, ease: "power3.out" });
    }
  }

  emblemBtn.addEventListener("click", () => setMode(!active));
  emblemBtn.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMode(!active); }
  });
  window.addEventListener("keydown", e => { if (e.key === "Escape" && active) setMode(false); });

  toolbar.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.tool) {
      tool = b.dataset.tool;
      toolbar.querySelectorAll("[data-tool]").forEach(x => x.classList.toggle("on", x === b));
    } else if (b.dataset.act === "clear") {
      cells.clear(); redraw(); save();
    } else if (b.dataset.act === "save") {
      const out = document.createElement("canvas");
      out.width = canvas.width; out.height = canvas.height;
      const o = out.getContext("2d");
      o.fillStyle = "#0d0d0d"; o.fillRect(0, 0, out.width, out.height);
      o.drawImage(canvas, 0, 0);
      const a = document.createElement("a");
      a.download = "pixel-drawing.png";
      a.href = out.toDataURL("image/png");
      a.click();
    }
  });

  window.addEventListener("resize", resize);
  window.addEventListener("load", resize);
  resize();
})();


/* =========================
   HOVER BOOK IMAGE
   A 3D object follows the cursor over the numbered lists (item n -> book n).
========================= */

(() => {
  const pic = document.querySelector("#hoverPic");

  /* ---------------------------------------------------------------
     CHOOSE YOUR OWN HOVER PICTURES (edit this block)
     Pictures live in images/hover/. Use the number (3 = book-03.png)
     or a file name ("book-03.png"). A row with no pick shows no picture.

     1) By entry title: the same picture on the front page AND the Memories page.
        Typing is not case sensitive, but the title must match the entry's title.
          "My first trip": 3,
          "Rainy night": "book-09.png",

     2) By row position (optional, for the sample rows or when you do not want to
        use titles). front = the 8 rows on the front page; memories = the rows on the
        Memories page as they appear (1 = top row of the current page).
          front: { 1: 2, 2: 5 },
  --------------------------------------------------------------- */
  const HOVER_BY_TITLE = {
    // "Entry title": 1,
  };
  const HOVER_BY_POSITION = {
    front: {
      1: "block.png",
    },
    memories: {
      1: "s.png",
    },
  };
  const HOVER_DIR = "images/hover/";
  /* --------------------------------------------------------------- */

  const urlOf = v => typeof v === "number" ? `${HOVER_DIR}book-${String(v).padStart(2, "0")}.png` : HOVER_DIR + v;
  const titleMap = {};
  Object.keys(HOVER_BY_TITLE).forEach(k => { titleMap[k.trim().toLowerCase()] = HOVER_BY_TITLE[k]; });
  const pickFor = (li, listKey, index) => {
    const t = ((li.querySelector("b") || {}).textContent || "").trim().toLowerCase();
    let v = t in titleMap ? titleMap[t] : (HOVER_BY_POSITION[listKey] || {})[index + 1];
    return v == null || v === "" ? null : urlOf(v);
  };

  /* Halftone look from the reference: black diamond dots on a 45deg screen,
     transparent between them. Built once per image on a canvas.
     If the browser blocks reading pixels (page opened as file://), the
     original image is used instead - run a local server to get the effect. */
  const HALFTONE = true;   // on: the block is rebuilt as a 45deg screen of black diamond dots (a solid PNG would show as a flat block)
  const OUT_W = 780;       // working width in px (shown ~17u wide, so it stays sharp)
  const PITCH = 7;         // distance between dots (bigger = coarser, smaller = more detail); ~110 dots across, dot size scales with it so it stays light
  const INK = "#121212";

  function halftone(img) {
    const w = OUT_W, h = Math.round(OUT_W * img.naturalHeight / img.naturalWidth);
    const a = document.createElement("canvas"); a.width = w; a.height = h;
    const actx = a.getContext("2d", { willReadFrequently: true });
    actx.drawImage(img, 0, 0, w, h);
    const px = actx.getImageData(0, 0, w, h).data;      // throws on file:// (caught below)


    const o = document.createElement("canvas"); o.width = w; o.height = h;
    const ctx = o.getContext("2d");
    ctx.fillStyle = INK;
    ctx.beginPath();

    const ang = Math.PI / 4, cos = Math.cos(ang), sin = Math.sin(ang);
    const diag = Math.hypot(w, h), P = PITCH, t = P / 4;   // small sampling area = sharper detail
    const samples = [[-t,-t],[t,-t],[0,0],[-t,t],[t,t]];

    for (let u = -diag; u < diag; u += P) {
      for (let v = -diag; v < diag; v += P) {
        const cx = w / 2 + u * cos - v * sin;
        const cy = h / 2 + u * sin + v * cos;
        if (cx < -P || cy < -P || cx > w + P || cy > h + P) continue;

        let cov = 0;
        for (const [dx, dy] of samples) {
          const x = Math.min(w - 1, Math.max(0, Math.round(cx + dx)));
          const y = Math.min(h - 1, Math.max(0, Math.round(cy + dy)));
          const i = (y * w + x) * 4;
          const al = px[i + 3] / 255;
          const lum = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
          cov += al * (1 - lum);                    // dark = big dot, light / white / transparent = none
        }
        cov /= samples.length;
        cov = Math.pow(cov, 1.2);                  // lighter mid-tones: more air between the dots
        if (cov < 0.06) continue;

        const s = P * 0.36 * Math.sqrt(Math.min(1, cov * 0.9));     // half-side of the dot: even at full black ~1/3 of the pitch stays open, so every dot reads on its own
        // diamond = square rotated by the screen angle
        const ux = cos * s, uy = sin * s, vx = -sin * s, vy = cos * s;
        ctx.moveTo(cx - ux - vx, cy - uy - vy);
        ctx.lineTo(cx + ux - vx, cy + uy - vy);
        ctx.lineTo(cx + ux + vx, cy + uy + vy);
        ctx.lineTo(cx - ux + vx, cy - uy + vy);
        ctx.closePath();
      }
    }
    ctx.fill();
    return o.toDataURL("image/png");
  }

  const done = {};          // url -> final src (halftoned or original)
  const jobs = {};
  function load(url) {
    if (!jobs[url]) {
      jobs[url] = new Promise(res => {
        const im = new Image();
        im.onload = () => {
          let out = url;
          if (HALFTONE) { try { out = halftone(im); } catch (e) { /* tainted canvas: keep original */ } }
          done[url] = out; res(out);
        };
        im.onerror = () => res(url);
        im.src = url;
      });
    }
    return jobs[url];
  }
  // preload + process only the pictures you picked
  [...Object.values(HOVER_BY_TITLE), ...Object.values(HOVER_BY_POSITION.front || {}), ...Object.values(HOVER_BY_POSITION.memories || {})]
    .forEach(v => { if (v != null && v !== "") load(urlOf(v)); });

  gsap.set(pic, { xPercent: -50, yPercent: -50 });
  // slow, floaty follow like the reference (the picture trails the cursor)
  const qx = gsap.quickTo(pic, "x", { duration: 0.8, ease: "power3.out" });
  const qy = gsap.quickTo(pic, "y", { duration: 0.8, ease: "power3.out" });

  const pos = e => {
    const r = stage.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  let cur = null, hovering = false;

  // delegated, so the lists can be re-rendered (journal.js) without losing the hover picture
  function bind(listSel, listKey) {
    const list = document.querySelector(listSel);
    if (!list) return;
    let curLi = null;
    const itemOf = e => { const li = e.target.closest && e.target.closest("li"); return li && list.contains(li) ? li : null; };
    list.addEventListener("mouseover", e => {
      const li = itemOf(e);
      if (!li || li === curLi) return;
      curLi = li;
      const url = pickFor(li, listKey, [...list.children].indexOf(li));
      if (!url) { cur = null; hovering = false; pic.classList.remove("on"); return; }   // nothing picked for this row
      cur = url; hovering = true;
      if (!pic.classList.contains("on")) {
        const [x, y] = pos(e);
        gsap.set(pic, { x, y });
      }
      if (done[url]) { pic.src = done[url]; pic.classList.add("on"); }
      else load(url).then(out => { if (hovering && cur === url) { pic.src = out; pic.classList.add("on"); } });
    });
    list.addEventListener("mousemove", e => { if (!itemOf(e)) return; const [x, y] = pos(e); qx(x); qy(y); });
    list.addEventListener("mouseleave", () => { curLi = null; hovering = false; pic.classList.remove("on"); });
  }

  bind("#stage > .card-grey .book-list", "front");
  bind("#stage > .card-white .card-list", "memories");
})();


/* =========================
   LIVE HALFTONE FLOWER
   Rebuilds the flower from images/flower.jpg as a 45deg lattice of diamond
   dots with gaps (dot size = how dark the photo is). The lattice drifts with
   the mouse and the dots swell near the cursor.
   If the browser blocks reading pixels (page opened as file://), the plain
   flower-halftone.png stays. Use a local server to get the live version.
========================= */

(() => {
  const img = document.querySelector("img.flower");
  if (!img) return;

  const W = 820;              // backing width (displayed ~410px wide, so 2x sharp)
  const P = 16;               // dot pitch in backing px  -> bigger = coarser (the reference has big, clearly separate dots)
  const INK = "#333333";      // dark grey, not black, like the reference
  const ANG = Math.PI / 4;
  const cos = Math.cos(ANG), sin = Math.sin(ANG);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const status = m => { window.__flowerStatus = m; };
  status("flower code started, waiting for the image");

  const photo = new Image();
  let fallback = false;                       // true when flower.jpg is missing and the halftone PNG is used as the source
  photo.onerror = () => {
    if (fallback) { status("OFF: neither images/flower.jpg nor the PNG could be loaded (check the images folder)"); console.warn("[flower] could not load images/flower.jpg or the PNG fallback"); return; }
    fallback = true;
    console.warn("[flower] images/flower.jpg not found, building the live flower from", img.getAttribute("src"));
    photo.src = img.getAttribute("src");
  };
  photo.onload = () => {
    const H = Math.round(W * photo.naturalHeight / photo.naturalWidth);

    const t = document.createElement("canvas");
    t.width = W; t.height = H;
    const tc = t.getContext("2d", { willReadFrequently: true });
    tc.fillStyle = "#fff"; tc.fillRect(0, 0, W, H);                       // transparent PNG areas count as paper
    if (fallback) tc.filter = "blur(9px)";                               // blur the old dots into a smooth tone map
    tc.drawImage(photo, 0, 0, W, H);
    tc.filter = "none";
    let px;
    try { px = tc.getImageData(0, 0, W, H).data; }
    catch (e) { status("OFF: browser blocked reading the image (page opened as file://). Use a local server / Live Server"); console.warn("[flower] browser blocked reading pixels (file://?). Run a local server, e.g. `python3 -m http.server`, to get the reactive flower."); return; }

    const dark = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      dark[i] = 1 - (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255;
    }

    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    c.className = img.className;
    c.setAttribute("aria-hidden", "true");
    const ctx = c.getContext("2d");
    img.after(c);
    img.style.display = "none";

    const q = P / 4;
    const S = [[-q, -q], [q, -q], [-q, q], [q, q]];
    const n = Math.ceil(Math.hypot(W, H) / P) + 2;

    let ox = 0, oy = 0, tx = 0, ty = 0, cx = -9999, cy = -9999, dirty = true;
    let ex = -9999, ey = -9999, act = 0, actT = 0;     // eased cursor position + how strongly the dots react (0..1)
    const R2 = 55 * 55;                                 // reach of the cursor, in backing px
    const PUSH = 14;                                    // how far dots get shoved away from the cursor at the centre

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = INK;
      ctx.beginPath();
      const bx = W / 2 + ox, by = H / 2 + oy;
      for (let i = -n; i <= n; i++) {
        for (let j = -n; j <= n; j++) {
          const x = bx + (i * cos - j * sin) * P;
          const y = by + (i * sin + j * cos) * P;
          if (x < 0 || y < 0 || x >= W || y >= H) continue;

          let d = 0;
          for (const [dx, dy] of S) {
            d += dark[Math.min(H - 1, Math.max(0, (y + dy) | 0)) * W + Math.min(W - 1, Math.max(0, (x + dx) | 0))];
          }
          let cov = Math.pow(Math.min(1, (d / 4) * 1.15), 1.15);          // a little lighter in the mid-tones
          if (cov < 0.06) continue;

          // react to the cursor: dots near it grow and get pushed away, like a lens bulging over the flower
          let px2 = x, py2 = y, g = 0;
          if (act > 0.001) {
            const ddx = x - ex, ddy = y - ey, dist2 = ddx * ddx + ddy * ddy;
            g = act * Math.exp(-dist2 / R2);
            if (g > 0.002) {
              const dist = Math.sqrt(dist2) || 1;
              const push = g * PUSH * Math.min(1, dist / 22);   // dead centre stays put instead of jittering
              px2 = x + (ddx / dist) * push;
              py2 = y + (ddy / dist) * push;
              cov = Math.min(1, cov * (1 + 1.1 * g));
            }
          }

          const h = 0.5 * P * Math.sqrt(cov) * 0.8 * (1 + 0.25 * g);   // half side of the diamond: even the darkest dot keeps a gap round it
          const ux = cos * h, uy = sin * h, vx = -sin * h, vy = cos * h;
          ctx.moveTo(px2 - ux - vx, py2 - uy - vy);
          ctx.lineTo(px2 + ux - vx, py2 + uy - vy);
          ctx.lineTo(px2 + ux + vx, py2 + uy + vy);
          ctx.lineTo(px2 - ux + vx, py2 - uy + vy);
          ctx.closePath();
        }
      }
      ctx.fill();
    }

    status("ON" + (reduce ? " (reduced-motion is set on your system: lattice drift off, cursor lens still on)" : ""));
    {
      window.addEventListener("mousemove", e => {
        if (window.__pageBusy) return;
        const r = c.getBoundingClientRect();
        cx = (e.clientX - r.left) * W / r.width;
        cy = (e.clientY - r.top) * H / r.height;
        if (act < 0.01) { ex = cx; ey = cy; }            // coming back in: start at the cursor, don't swoop across
        actT = 1;
        // EVERY dot of the screen slides the same way the cursor goes (right -> dots right, up -> dots up), up to one
        // full dot spacing each side across the window, eased so it follows softly
        if (!reduce) {
          tx = (e.clientX / innerWidth - 0.5) * P * 2;
          ty = (e.clientY / innerHeight - 0.5) * P * 2;
        }
        dirty = true;
      });
      document.addEventListener("mouseleave", () => { actT = 0; });   // cursor left the window: dots relax
      window.addEventListener("blur", () => { actT = 0; });
    }

    (function tick() {
      ox += (tx - ox) * 0.08;
      oy += (ty - oy) * 0.08;
      ex += (cx - ex) * 0.18;                             // the lens trails the cursor a little
      ey += (cy - ey) * 0.18;
      act += (actT - act) * 0.1;
      const moving = Math.abs(tx - ox) + Math.abs(ty - oy) > 0.01
                  || Math.abs(cx - ex) + Math.abs(cy - ey) > 0.05
                  || Math.abs(actT - act) > 0.002;
      if (dirty || moving) { draw(); dirty = false; }
      requestAnimationFrame(tick);
    })();
  };
  photo.src = "images/flower.jpg";
})();


/* =========================
   PAGES (same webpage, sheets drop away and the next page rises in)
   About / Books / Credits / Contacts are different arrangements of the same
   four sheets. Switching: every sheet drops down at an angle, the layout
   changes while they are off-screen, then they swing back up and settle.
========================= */

(() => {
  const stageEl = document.querySelector("#stage");
  const links = document.querySelectorAll(".nav-links a");
  const previewTabs = document.querySelectorAll(".thumb[data-page]");
  const HREF = { about: "#about", books: "#books", credits: "#credits", contacts: "#contact" };
  let current = "about", busy = false;

  stageEl.dataset.page = "about";
  const setActive = p => {
    links.forEach(a => {
      const active = a.getAttribute("href") === HREF[p];
      a.classList.toggle("active", active);
      if (active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    previewTabs.forEach(tab => {
      const active = tab.dataset.page === p;
      tab.classList.toggle("active", active);
      if (active) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
  };
  setActive("about");

  // Left-side miniature pages are live navigation controls, not decorative previews.
  previewTabs.forEach(tab => {
    tab.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      goToPage(tab.dataset.page);
    });
  });

  /* ---- page-change motion ------------------------------------------------
     Tuned from a frame-by-frame (60fps) read of the reference recording.

     DROP  The grey sheet leaves first and the others start ~0.1s later, but
           the later ones fall faster, so the whole stack clears together
           after ~0.37s. Curve is roughly progress^2.5: almost still for the
           first 60ms, then accelerating hard. The tilt starts BEFORE the
           fall picks up speed (the sheet peels away, then drops).
     BEAT  ~0.19s of empty stage. The thumbnail strip re-sorts in this gap.
     RISE  Grey sheet first (~0.64s), the rest trail 0.1-0.2s behind and land
           within ~0.1s of it. Curve is roughly 1-(1-p)^3.4: fast launch, long
           soft landing. The tilt unwinds more slowly than the rise.
           Sheets start just below the bottom edge: no invisible dead travel.

     WEIGHT stretches every duration. 1 = the reference exactly, higher = heavier.
     The per-sheet numbers are seconds at WEIGHT 1; tilts are degrees. */

  gsap.config({ force3D: true });     // stay on the GPU the whole time: no snap when a tween ends

  const FX = {
    WEIGHT: 1.22,
    DROP_END: 0.37,
    BEAT: 0.19,
    RISE_END: 0.64,
    CLICKED_DELAY: 0.08,    // the clicked page lands a hair after the rest, so it ends up on top
    dropY: p => Math.pow(p, 2.5),
    dropR: p => Math.pow(p, 1.8),
    riseY: p => 1 - Math.pow(1 - p, 3.4),
    riseR: p => 1 - Math.pow(1 - p, 2.2),
    // cascade + tilt, matching the original site's recording
    sheets: [
      { sel: ".card-grey",   dropAt: 0,    dropTilt: -2.5, riseAt: 0,    riseTilt: -3.5 },
      { sel: ".card-orange", dropAt: 0.05, dropTilt:  3.5, riseAt: 0.10, riseTilt:  3   },
      { sel: ".card-cream",  dropAt: 0.08, dropTilt: -6,   riseAt: 0.20, riseTilt:  5   },
      { sel: ".card-white",  dropAt: 0.10, dropTilt:  4.5, riseAt: 0.16, riseTilt: -4   }
    ],
    pageSheet: { about: ".card-grey", books: ".card-white", credits: ".card-orange", contacts: ".card-cream" }
  };

  window.goToPage = function (page) {
    if (!HREF[page] || page === current || busy) return;
    busy = true;
    window.__pageBusy = true;                      // pause mouse parallax + live canvases while sheets travel
    current = page;
    setActive(page);                               // nav + thumbnail highlight answer the click instantly
    stageEl.classList.add("paging");

    const W = FX.WEIGHT;
    const reduce = false;   // always play the drop/rise (the cross-fade fallback looked like a blink)
    const sheets = FX.sheets.map(s => ({ ...s, el: stageEl.querySelector(":scope > " + s.sel) }));
    const els = sheets.map(s => s.el);

    // distance that puts a sheet's top edge just past the bottom of the stage
    const away = el => stageEl.clientHeight * 1.08 - el.offsetTop;

    // while the sheets are off-screen: new arrangement, new scroll length, thumbnails re-sort
    const swap = () => {
      stageEl.dataset.page = page;
      window.scrollTo(0, 0);
      if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
      layoutScroll();
      if (window.syncThumbOrder) window.syncThumbOrder(page);
    };

    const finish = () => {
      busy = false;
      window.__pageBusy = false;
      stageEl.classList.remove("paging");
      if (lenis) lenis.start();
      // thumbnail copies are rebuilt once everything has settled, never while sheets move
      (window.requestIdleCallback || (f => setTimeout(f, 250)))(
        () => window.rebuildThumbs && window.rebuildThumbs(), { timeout: 1500 }
      );
    };

    const run = () => {
      if (lenis) lenis.stop();                     // no scrolling mid-transition
      const tl = gsap.timeline({ onComplete: finish });

      if (reduce) {                                // reduced motion: a quick cross-fade instead
        tl.to(els, { opacity: 0, duration: 0.15 })
          .call(swap)
          .to(els, { opacity: 1, duration: 0.25 });
        return;
      }

      const dropEnd = FX.DROP_END * W;

      // 1. DROP: staggered starts, shared finish
      sheets.forEach(s => {
        const at = s.dropAt * W, dur = dropEnd - at;
        tl.to(s.el, { y: away(s.el), duration: dur, ease: FX.dropY }, at);
        tl.to(s.el, { rotation: s.dropTilt, duration: dur, ease: FX.dropR }, at);
      });

      // 2. SWAP: runs the instant the stage is empty, then parks each sheet below the edge
      tl.call(() => {
        swap();
        sheets.forEach(s => gsap.set(s.el, { y: away(s.el), rotation: s.riseTilt }));
      }, null, dropEnd);

      // 3. RISE: lead sheet first, the rest trail behind and land close to it
      const base = dropEnd + FX.BEAT * W;
      sheets.forEach(s => {
        const lag = s.sel === FX.pageSheet[page] ? FX.CLICKED_DELAY : 0;
        const at = base + (s.riseAt + lag) * W;
        const end = base + (FX.RISE_END + s.riseAt + lag) * W;
        tl.to(s.el, { y: 0, duration: end - at, ease: FX.riseY }, at);
        tl.to(s.el, { rotation: 0, duration: end - at, ease: FX.riseR }, at);
      });
    };

    // clicked while scrolled down (thumbnails and rear sheets stay clickable): glide back to
    // the top first, otherwise the long grey sheet would still fill the screen as it "drops"
    if (window.scrollY < 4) { run(); return; }
    let started = false;
    const once = () => { if (!started) { started = true; run(); } };
    if (lenis) lenis.scrollTo(0, { duration: 0.6, lock: true, easing: t => 1 - Math.pow(1 - t, 3), onComplete: once });
    else window.scrollTo({ top: 0, behavior: "smooth" });
    gsap.delayedCall(0.9, once);                   // safety net
  };

  // click a sheet that is behind: its page comes up
  const SHEET_PAGE = { ".card-white": "books", ".card-orange": "credits", ".card-grey": "about" };
  Object.entries(SHEET_PAGE).forEach(([sel, page]) => {
    document.querySelector(sel).addEventListener("click", e => {
      if (document.body.classList.contains("drawing") || current === page) return;
      e.preventDefault();
      e.stopPropagation();
      goToPage(page);
    }, true);
  });
})();


/* =========================
   MENU OVERVIEW
   "Menu" shows the four pages side by side. Click one (or press 1-4) to go
   there; Close / Escape returns to the page you were on.
========================= */

(() => {
  const ov = document.querySelector("#overview");
  const menu = document.querySelector(".nav-menu");
  const closeBtn = ov.querySelector(".ov-close");
  const cols = gsap.utils.toArray(".ov-col");
  let open = false;
  ov.inert = true;

  function show(on) {
    if (on === open || document.body.classList.contains("drawing") || window.__pageBusy) return;
    open = on;
    document.body.classList.toggle("overview-open", on);
    ov.setAttribute("aria-hidden", String(!on));
    ov.inert = !on;
    if (on) {
      if (lenis) { lenis.scrollTo(0, { immediate: true }); lenis.stop(); }
      window.scrollTo(0, 0);
      gsap.fromTo(ov, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, ease: "power2.out", overwrite: true });
      gsap.fromTo(cols, { y: 90, rotation: i => TILTS(i) }, { y: 0, rotation: 0, duration: 0.9, stagger: 0.07, ease: "power3.out", overwrite: true });
      closeBtn.focus({ preventScroll: true });
    } else {
      gsap.to(ov, { autoAlpha: 0, duration: 0.35, ease: "power2.in", overwrite: true });
      if (lenis) lenis.start();
      menu.focus({ preventScroll: true });
    }
  }

  menu.addEventListener("click", e => { e.preventDefault(); show(true); });
  closeBtn.addEventListener("click", () => show(false));
  cols.forEach(col => col.addEventListener("click", () => {
    show(false);
    gsap.delayedCall(0.3, () => window.goToPage(col.dataset.page));
  }));
  window.addEventListener("keydown", e => {
    if (!open) return;
    if (e.key === "Escape") show(false);
    else if (/^[1-4]$/.test(e.key)) cols[+e.key - 1].click();
  });
})();


/* =========================
   LIVE PAGE THUMBNAILS
   Each left-hand thumbnail is a scaled-down copy of the real sheet (same
   markup, same CSS), so it shows the actual page detail. Canvases (the live
   halftone flower) are re-copied continuously; the markup is rebuilt when the
   page changes, the window resizes, or fonts/images finish loading.
========================= */

(() => {
  const stageEl = document.querySelector("#stage");
  const SRC = { about: "card-grey", books: "card-white", credits: "card-orange", contacts: "card-cream" };
  const FRAC = { about: 0.575, books: 0.40, credits: 0.486, contacts: 0.246 };   // sheet width / stage width
  const source = p => [...stageEl.children].find(el => el.classList.contains(SRC[p]));

  function build() {
    const sw = stageEl.clientWidth;
    document.querySelectorAll(".thumb[data-page]").forEach(t => {
      const p = t.dataset.page, src = source(p), box = t.querySelector(".mini");
      if (!src || !box) return;
      const clone = src.cloneNode(true);
      clone.removeAttribute("style"); clone.classList.remove("open");
      ["data-depth", "aria-hidden"].forEach(a => clone.removeAttribute(a));
      clone.querySelectorAll("[id],[name]").forEach(n => { n.removeAttribute("id"); n.removeAttribute("name"); });
      clone.querySelectorAll("a,button,input,[tabindex]").forEach(n => { n.tabIndex = -1; });
      if (p === "credits" && src.style.height) clone.style.height = src.style.height;
      if (p === "contacts") clone.style.height = "36cqh";
      const refW = sw * FRAC[p];
      const inner = document.createElement("div");
      inner.className = "mini-inner";
      inner.style.width = refW + "px";
      inner.style.transform = "scale(" + (t.clientWidth / refW) + ")";
      inner.append(clone);
      box.textContent = "";
      box.append(inner);
      copyCanvases(src, clone);
    });
  }

  function copyCanvases(src, clone) {
    const a = src.querySelectorAll("canvas"), b = clone.querySelectorAll("canvas");
    if (a.length !== b.length) return false;
    a.forEach((c, i) => {
      if (b[i].width !== c.width) { b[i].width = c.width; b[i].height = c.height; }
      b[i].getContext("2d").drawImage(c, 0, 0);
    });
    return true;
  }

  window.rebuildThumbs = build;

  setInterval(() => {                                    // keep live canvases in sync
    if (document.hidden || window.__pageBusy) return;
    document.querySelectorAll(".thumb[data-page]").forEach(t => {
      const clone = t.querySelector(".mini .card"), src = source(t.dataset.page);
      if (clone && src && !copyCanvases(src, clone)) build();
    });
  }, 150);

  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(build, 150); });
  const again = () => { build(); setTimeout(build, 1500); };
  if (document.readyState === "complete") again(); else window.addEventListener("load", again, { once: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
  build();
})();


/* =========================
   THUMBNAIL STACK = SCENE ORDER
   The "≡" under each thumbnail is a grab handle. Drag it to move that page
   up/down the strip (neighbours slide out of the way, the page snaps into its
   slot on release). The thumbnail at the TOP is the current scene: if a drop
   changes it, the stage switches to that page. Going to a page any other way
   (nav, Menu, clicking a thumbnail) also brings its thumbnail to the top.
========================= */

(() => {
  const strip = document.querySelector(".thumbs");
  const kids = () => [...strip.children];
  const layoutTop = el => el.getBoundingClientRect().top - gsap.getProperty(el, "y");
  const current = () => { const a = strip.querySelector(".thumb.active"); return a && a.dataset.page; };

  // FLIP: run `change` (a DOM reorder), then slide every other thumbnail from where it was
  function flip(change, skip) {
    const before = new Map(kids().map(el => [el, el.getBoundingClientRect().top]));
    change();
    kids().forEach(el => {
      if (el === skip) return;
      const d = before.get(el) - layoutTop(el);
      if (Math.abs(d) > 0.5) gsap.fromTo(el, { y: d }, { y: 0, duration: 0.5, ease: "power3.out", overwrite: true });
    });
  }

  window.syncThumbOrder = page => {
    const t = strip.querySelector('.thumb[data-page="' + page + '"]');
    if (t && strip.firstElementChild !== t) flip(() => strip.prepend(t));
  };

  let drag = null, suppressClick = false;

  strip.querySelectorAll(".thumb").forEach(t => {
    t.addEventListener("pointerdown", e => {
      if (e.button) return;   // the whole thumbnail drags (a plain click still opens the page)
      gsap.killTweensOf(t, "y");
      drag = { t, off: e.clientY - t.getBoundingClientRect().top, y0: e.clientY, moved: false };
      if (t.setPointerCapture) t.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    t.addEventListener("pointermove", e => {
      if (!drag || drag.t !== t) return;
      if (!drag.moved) {
        if (Math.abs(e.clientY - drag.y0) < 4) return;
        drag.moved = true;
        t.classList.add("dragging");
        document.body.classList.add("dragging-thumb");
      }
      const follow = () => gsap.set(t, { y: e.clientY - drag.off - layoutTop(t) });
      follow();

      const list = kids(), i = list.indexOf(t);
      const centre = t.getBoundingClientRect().top + t.offsetHeight / 2;
      const mid = el => layoutTop(el) + el.offsetHeight / 2;
      const next = list[i + 1], prev = list[i - 1];
      if (next && centre > mid(next)) { flip(() => next.after(t), t); follow(); }
      else if (prev && centre < mid(prev)) { flip(() => prev.before(t), t); follow(); }
    });

    const release = () => {
      if (!drag || drag.t !== t) return;
      const moved = drag.moved;
      drag = null;
      t.classList.remove("dragging");
      document.body.classList.remove("dragging-thumb");
      if (!moved) return;                                   // plain click: the normal click handler opens the page
      suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
      gsap.to(t, { y: 0, duration: 0.45, ease: "power3.out" });
      const top = strip.firstElementChild.dataset.page;
      if (top !== current() && window.goToPage) window.goToPage(top);
    };
    t.addEventListener("pointerup", release);
    t.addEventListener("pointercancel", release);

    // a drag must not also count as a click on the dragged page
    t.addEventListener("click", e => {
      if (suppressClick) { e.stopImmediatePropagation(); e.preventDefault(); }
    }, true);
  });
})();



/* =========================
   BOOKS PAGE BARS
   Every bar sways on its own slow wave. Hovering a bar straightens it and
   darkens it; when the cursor leaves it eases back slowly, leaving a trail.
========================= */

(() => {
  const bars = [...document.querySelectorAll("#stage > .card-white .w-bars i")];
  if (!bars.length) return;
  const reduce = false;   // your system has "reduce motion" on, which froze the bars; this motion is slow and subtle
  const REST = "#cbcbca", HOT = "#a4a4a3";

  const items = bars.map((el, i) => ({ el, i, h: 0 }));

  const SHRINK = 0;                        // the reference does not shrink the bar; raise (e.g. 0.08) if you want that
  const SPEED = 1.1;                       // bars per second, sliding leftwards
  const IN = 14, OUT = 6;                  // easing rates: snaps up in ~0.2s, lets go in ~0.5s (like the reference)
  const lerpC = (a, b, t) => Math.round(a + (b - a) * t);

  // fixed leans: some bars straight, some slanted either way (they travel with the bar)
  const pattern = x => {
    const n = Math.sin(x * 0.55) * 0.9 + Math.sin(x * 1.37 + 1.3) * 0.7 + Math.sin(x * 0.21 + 4.1) * 0.8;
    const d = Math.abs(n) - 0.75;
    return d > 0 ? Math.sign(n) * Math.min(d, 1.1) * 2.6 : 0;
  };
  const leans = items.map(it => pattern(it.i * 1.9 + 3));

  let pitch = 0, total = 0, lift = 8, barW = 0;
  const measure = () => {
    if (bars.length < 2) return;
    // exact (fractional) pitch = bar width + gap. offsetLeft is rounded to whole pixels, and that
    // rounding added up along the row and made some gaps wider than others.
    const w = parseFloat(getComputedStyle(bars[0]).width);
    const gap = parseFloat(getComputedStyle(bars[0].parentElement).columnGap) || 0;
    pitch = w + gap;
    total = pitch * bars.length;
    barW = w;
    lift = barW * 0.3;
  };
  window.addEventListener("resize", measure);
  window.addEventListener("load", measure);
  measure();

  // pointer position; hover is decided from where each bar's slot is (not where the lifted,
  // shrunken bar is), so a bar never flickers when it moves out from under the cursor
  let mx = -9999, my = -9999;
  window.addEventListener("mousemove", e => { mx = e.clientX; my = e.clientY; }, { passive: true });
  document.addEventListener("mouseleave", () => { mx = my = -9999; });
  const row = bars[0].parentElement;

  gsap.ticker.add((time, dtMs) => {
    if (window.__pageBusy) return;
    if (!pitch) measure();
    if (!pitch) return;
    const dt = Math.min(0.05, dtMs / 1000);
    const r = row.getBoundingClientRect();
    const inRow = my >= r.top && my <= r.bottom;
    const shift = time * SPEED * pitch;

    items.forEach((it, i) => {
      let x = i * pitch - shift;
      x = ((x + pitch * 1.5) % total + total) % total - pitch * 1.5;     // wrap just past the left edge

      // is the pointer over this bar's slot?  (slot left = row left + x)
      const left = r.left + x;                       // the first slot starts at the row's left edge
      const over = inRow && mx >= left && mx <= left + barW;

      const rate = over ? IN : OUT;
      it.h += ((over ? 1 : 0) - it.h) * (1 - Math.exp(-rate * dt));
      const e = it.h * it.h * (3 - 2 * it.h);                           // smoothstep, so the ends are soft

      it.el.style.translate = (x - i * pitch).toFixed(2) + "px " + (-e * lift).toFixed(2) + "px";
      it.el.style.scale = (1 - SHRINK * e).toFixed(4);
      it.el.style.rotate = (leans[i] * (1 - e)).toFixed(3) + "deg";
      it.el.style.backgroundColor = "rgb(" + lerpC(203, 164, e) + "," + lerpC(203, 164, e) + "," + lerpC(202, 163, e) + ")";
    });
  });
})();



/* =========================
   ORANGE SHEET BLOCKS + CREAM CARD CLICK
========================= */

(() => {
  // blocks: 3 columns, each cell either full width or inset on one/both sides (fixed pattern)
  const host = document.querySelector("#oBlocks");
  if (host) {
    const ROWS = 90;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < 3; c++) {
        const v = (r * 31 + c * 17 + ((r * c) % 5) * 13) % 10;
        const el = document.createElement("i");
        if (v === 5 || v === 6) el.className = "b";
        else if (v === 7 || v === 8) el.className = "l";
        else if (v === 9) el.className = "r";
        host.appendChild(el);
      }
    }
    if (window.rebuildThumbs) window.rebuildThumbs();     // the Credits thumbnail copies this markup
  }
})();


/* =========================
   CREAM CARD: no hover movement. "Contact us" flips the card over to its back,
   which shows the contact info. Close / click outside / Esc flips it back.
========================= */

(() => {
  const card = document.querySelector("#stage > .card-cream");
  const stageEl = document.querySelector("#stage");
  let flipped = false, flipping = false;

  gsap.set(card, { transformPerspective: 900 });

  function flip(to) {
    if (flipping || to === flipped) return;
    flipping = true;
    gsap.timeline({ onComplete: () => { flipping = false; } })
      .to(card, { rotationY: 90, duration: 0.28, ease: "power2.in" })
      .call(() => { flipped = to; card.classList.toggle("open", to); })
      .set(card, { rotationY: -90 })
      .to(card, { rotationY: 0, duration: 0.38, ease: "power2.out" });
  }

  // capture phase: runs before the "bring the sheet forward" handlers
  card.addEventListener("click", e => {
    if (document.body.classList.contains("drawing")) return;
    if (e.target.closest(".contact-link")) {            // Contact us -> flip, on any page
      e.preventDefault(); e.stopPropagation(); flip(true); return;
    }
    if (e.target.closest(".cc-close")) { e.preventDefault(); e.stopPropagation(); flip(false); return; }
    if (e.target.closest("a")) return;                  // real links (Instagram, LinkedIn, mail) work normally
    if (!flipped && stageEl.dataset.page !== "contacts") {   // from another page a click brings it forward
      e.preventDefault(); e.stopPropagation();
      window.goToPage("contacts");
    }
  }, true);

  const form = card.querySelector(".cc-back");
  // Contact only: opens the visitor's mail app with the message filled in.
  // Put your own address here (e.g. "me@example.com").
  const CONTACT_EMAIL = "";
  form.addEventListener("submit", e => {
    e.preventDefault();
    const label = form.querySelector(".cf-send span");
    const f = form.elements;
    if (!f.message.value.trim()) {
      label.textContent = "Add a message";
      f.message.focus();
      setTimeout(() => { label.textContent = "Send"; }, 1400);
      return;
    }
    if (!CONTACT_EMAIL) {
      label.textContent = "Set your email";
      setTimeout(() => { label.textContent = "Send"; }, 1800);
      return;
    }
    const body = f.message.value.trim() + "\n\n" + (f.name.value.trim() || "") + (f.email.value.trim() ? " <" + f.email.value.trim() + ">" : "");
    window.location.href = "mailto:" + CONTACT_EMAIL + "?subject=" + encodeURIComponent("Message from " + (f.name.value.trim() || "the journal")) + "&body=" + encodeURIComponent(body);
    label.textContent = "Sent ✓";
    setTimeout(() => { label.textContent = "Send"; form.reset(); flip(false); }, 900);
  });

  document.addEventListener("click", e => { if (flipped && !card.contains(e.target)) flip(false); });
  window.addEventListener("keydown", e => { if (e.key === "Escape" && flipped) flip(false); });
})();
