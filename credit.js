/* =========================
   ENTRIES PAGE: THE CREDIT STRIP  (Dreams' Work Journal)
   On the Entries page (the orange sheet) one strip is dark. It gives a small shake every few
   seconds, and the blocks around it sit a little scattered (slightly tilted and shifted).
   Click the dark strip: it winds up, the blocks around it straighten into one column, the strip
   slides into that column, and the credits write in beside it (label + name, with thin lines).
   Click it again, click anywhere else, or press Esc to close.

   Own file on purpose: it needs nothing from script.js or journal.js, and if it ever
   fails the Entries page simply stays as it was.

   >>> EDIT THE CREDITS IN THE "CREDITS" LIST BELOW <<<
========================= */

(() => {
  const TITLE = "Credits";                 // not printed on the strip: only read by screen readers
  const POSITION = 0.58;                   // how far down the screen the strip sits (0 = top, 1 = bottom)
  const SCATTER = 1;                       // how untidy the blocks around it are at rest (0 = perfectly straight, 2 = very messy)
  const CREDITS = [                        // [ label, name ]  (add or remove rows freely)
    ["Agency",         "DreamWorks"],
    ["Art",            "n'il"],
    ["Creative idea",  "n'il"],
    ["Developer",      "Kirtan Dhakal"]
  ];

  const stageEl = document.querySelector("#stage");
  const orange  = document.querySelector("#stage > .card-orange");
  const host    = document.querySelector("#oBlocks");
  if (!stageEl || !orange || !host) return;

  const N = CREDITS.length;
  const COLS = 3;
  const MIDDLE = 1;                        // column the dark strip starts in (0 left, 1 middle, 2 right)

  /* ---------- styles (injected, so a cached style.css can't break it) ---------- */
  if (!document.getElementById("credit-css")) {
    const st = document.createElement("style");
    st.id = "credit-css";
    const MOVE = "cubic-bezier(.6,0,.2,1)";                  // slow start, quick middle, soft landing
    st.textContent = `
      /* These rules also apply inside the small copies of this page (the Menu overview and the left-hand
         thumbnails), so the dark strip and its shake show there too. Opening the credits only works on the real page. */
      /* blocks that slide sideways are cut off at the edges of the strip area (they slide "into" the sheet edge) */
      :is(#stage, .mini-inner) > .card-orange .o-blocks { clip-path: inset(-200px calc(var(--u) * -.4)); }

      /* the strip: dark all the time, no text on it; it slides into the left column when opened */
      :is(#stage, .mini-inner) .o-blocks i[data-credit] {
        margin: 0; cursor: pointer;
        background-color: rgb(125, 38, 3);
        transition: background-color .5s ease, translate .75s ${MOVE};
      }
      /* little animation: a short shake every few seconds, then stillness */
      :is(#stage, .mini-inner) > .card-orange:not(.credit-open) .o-blocks i[data-credit]:not([data-credit-busy]) { animation: creditIdle 3.6s ease-in-out infinite; }
      @keyframes creditIdle {
        0%, 18%, 100% { transform: translateX(0) rotate(0); }
        3%  { transform: translateX(calc(var(--u) * -.16)) rotate(-.5deg); }
        6%  { transform: translateX(calc(var(--u) * .16)) rotate(.5deg); }
        9%  { transform: translateX(calc(var(--u) * -.11)) rotate(-.3deg); }
        12% { transform: translateX(calc(var(--u) * .11)) rotate(.3deg); }
        15% { transform: translateX(calc(var(--u) * -.05)) rotate(-.1deg); }
      }
      #stage > .card-orange.credit-open .o-blocks i[data-credit] {
        translate: var(--cx, 0px) 0; animation: none;
        transition: background-color .5s ease, translate .9s ${MOVE};
      }

      /* the blocks around it: a little scattered at rest ... */
      :is(#stage, .mini-inner) .o-blocks i[data-credit-zone] {
        rotate: calc(var(--jr, 0) * 1deg);
        translate: calc(var(--u) * var(--jx, 0)) calc(var(--u) * var(--jy, 0));
        transition:
          background-color .7s ease,
          opacity .45s ease calc(var(--d, 0) * 45ms),
          rotate .75s ${MOVE} calc(var(--d, 0) * 45ms),
          translate .75s ${MOVE} calc(var(--d, 0) * 45ms),
          margin .75s ${MOVE} calc(var(--d, 0) * 45ms);
      }
      /* ... and when the credits open they straighten and SLIDE, one row after another from the top:
         the middle column slides left and becomes the new left column, the old left column leaves through the
         left edge, the right column leaves through the right edge */
      #stage > .card-orange.credit-open .o-blocks i[data-credit-zone] {
        rotate: 0deg; translate: 0 0;
        transition:
          background-color .7s ease,
          rotate .9s ${MOVE} calc(var(--d, 0) * 70ms),
          translate .9s ${MOVE} calc(var(--d, 0) * 70ms),
          margin .9s ${MOVE} calc(var(--d, 0) * 70ms),
          opacity .25s ease calc(var(--d, 0) * 70ms + .6s);
      }
      #stage > .card-orange.credit-open .o-blocks i[data-credit-zone="keep"]  { translate: calc(var(--slide, 0px) * -1) 0; margin-left: 0; margin-right: 0; }
      #stage > .card-orange.credit-open .o-blocks i[data-credit-zone="left"]  { translate: calc(var(--slide, 0px) * -1) 0; opacity: 0; }
      #stage > .card-orange.credit-open .o-blocks i[data-credit-zone="right"] { translate: var(--slide, 0px) 0; opacity: 0; }

      /* the credits themselves */
      :is(#stage, .mini-inner) .credit-panel {
        position: absolute; z-index: 2; display: none;
        color: rgb(140, 44, 16); font-weight: 700; letter-spacing: -.02em;
      }
      :is(#stage, .mini-inner) .credit-panel, :is(#stage, .mini-inner) .credit-panel * { pointer-events: none !important; }
      :is(#stage, .mini-inner) .credit-panel.on { display: block; }
      :is(#stage, .mini-inner) .credit-panel p {
        margin: 0 0 var(--gap, 8px); height: var(--h, 30px); box-sizing: border-box;
        display: grid; grid-template-columns: 1fr 1fr; align-items: center;
        padding-left: calc(var(--u) * .2);
        border-top: 1px solid rgba(140, 44, 16, .6); border-bottom: 1px solid rgba(140, 44, 16, .6);
        font-size: calc(var(--u) * .75); line-height: 1.1;
        opacity: 0; transform: translateY(60%);
        transition: opacity .2s ease, transform .3s ease;
      }
      :is(#stage, .mini-inner) .credit-panel p b, :is(#stage, .mini-inner) .credit-panel p span { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      #stage > .card-orange.credit-open .credit-panel p {
        opacity: 1; transform: none;
        transition: opacity .5s ease, transform .7s ${MOVE};
        transition-delay: calc(var(--i) * 90ms + 900ms);
      }
      #stage .o-blocks i[data-credit]:focus-visible { outline: 2px solid #fff; outline-offset: -3px; }`;
    document.head.appendChild(st);
  }

  /* ---------- the credits panel (a sibling of #oBlocks, so journal.js never wipes it) ---------- */
  const panel = document.createElement("div");
  panel.className = "credit-panel";
  panel.setAttribute("role", "group");
  panel.setAttribute("aria-label", TITLE);
  CREDITS.forEach(([label, name], i) => {
    const p = document.createElement("p");
    p.style.setProperty("--i", i);
    const b = document.createElement("b"), s = document.createElement("span");
    b.textContent = label; s.textContent = name;
    p.append(b, s);
    panel.append(p);
  });
  orange.append(panel);

  /* ---------- picking the strip ---------- */
  let cur = null, zone = [], isOpen = false;

  const idx = el => Array.prototype.indexOf.call(host.children, el);
  const plain = el => el && !el.dataset.act && !el.classList.contains("o-entry") && !el.classList.contains("o-new");

  // the middle-column strip that rests nearest POSITION of the way down the screen (measured without any
  // scroll / slide offset, so it doesn't jump around), with free blocks around it and room for every credit row
  function choose(kids, base, top, bottom) {
    const target = top + (bottom - top) * POSITION;
    let best = null, bd = Infinity;
    for (let i = MIDDLE; i < kids.length; i += COLS) {
      const el = kids[i];
      if (!plain(el) || !kids[i + COLS]) continue;
      const pitch = kids[i + COLS].offsetTop - el.offsetTop;
      const y = base + el.offsetTop;
      if (y + pitch * N > bottom - 4) continue;                   // the credits would run off the screen
      const rowStart = i - MIDDLE;
      let free = true;
      for (let k = 0; k < N && free; k++) for (let c = 0; c < COLS; c++) {
        const o = kids[rowStart + COLS * k + c];
        if (!o || !plain(o)) { free = false; break; }
      }
      if (!free) continue;
      const d = Math.abs(y + el.offsetHeight / 2 - target);
      if (d < bd) { bd = d; best = el; }
    }
    return best;
  }

  function pick() {
    const sr = stageEl.getBoundingClientRect();
    const top = Math.max(0, sr.top), bottom = Math.min(window.innerHeight, sr.bottom);
    const base = sr.top + orange.offsetTop + host.offsetTop;      // resting top of the strip grid on screen
    return choose(host.children, base, top, bottom);
  }

  function clearMarks() {
    zone.forEach(z => {
      z.removeAttribute("data-credit-zone");
      ["--jr", "--jx", "--jy", "--d"].forEach(v => z.style.removeProperty(v));
    });
    zone = [];
    if (cur) {
      cur.removeAttribute("data-credit"); cur.style.removeProperty("--cx");
      ["role", "tabindex", "aria-label", "aria-expanded"].forEach(a => cur.removeAttribute(a));
    }
  }

  // a stable pseudo-random number for a block, so the scatter doesn't change on every refresh
  const rnd = (n, s) => { const x = Math.sin(n * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };

  const ZVARS = ["--jr", "--jx", "--jy", "--d"];
  function mark(kids, strip) {
    const out = [], rowStart = Array.prototype.indexOf.call(kids, strip) - MIDDLE;
    for (let k = -1; k <= N; k++) {
      for (let c = 0; c < COLS; c++) {
        const j = rowStart + COLS * k + c, el = kids[j];
        if (!el || el === strip || !plain(el)) continue;
        // keep: middle column (slides left, becomes the left column)   left: leaves through the left edge
        // right: leaves through the right edge   near: the rows just above / below (only straighten)
        const role = (k < 0 || k === N) ? "near" : c < MIDDLE ? "left" : c > MIDDLE ? "right" : "keep";
        el.dataset.creditZone = role;
        el.style.setProperty("--d", Math.max(0, k));
        if (SCATTER) {
          el.style.setProperty("--jr", ((rnd(j, 1) - .5) * 1.5 * SCATTER).toFixed(2));
          el.style.setProperty("--jx", ((rnd(j, 2) - .5) * .7 * SCATTER).toFixed(2));
          el.style.setProperty("--jy", ((rnd(j, 3) - .5) * .25 * SCATTER).toFixed(2));
        }
        out.push(el);
      }
    }
    return out;
  }

  function markZone() {
    zone.forEach(z => {
      z.removeAttribute("data-credit-zone");
      ZVARS.forEach(v => z.style.removeProperty(v));
    });
    zone = mark(host.children, cur);
  }

  /* The Menu overview calls this on its small copy of the orange sheet. It picks the same strip, with the same scatter and
     shake as the real page. The copy cannot be clicked and has no credits panel: it only needs the resting look. */
  function decorate(clone) {
    const h = clone && clone.querySelector(".o-blocks");
    if (!h) return;
    clone.classList.remove("credit-open");
    const pn = clone.querySelector(".credit-panel"); if (pn) pn.remove();
    h.querySelectorAll("[data-credit],[data-credit-zone]").forEach(el => {
      ["data-credit", "data-credit-zone", "data-credit-busy", "role", "tabindex", "aria-label", "aria-expanded"].forEach(a => el.removeAttribute(a));
      ZVARS.concat("--cx").forEach(v => el.style.removeProperty(v));
    });
    const H = stageEl.clientHeight;
    if (!H) return;
    const el = choose(h.children, H * 0.165 + h.offsetTop, 0, H);   // 16.5% = where the sheet sits on the Entries page
    if (!el) return;
    el.dataset.credit = TITLE;
    mark(h.children, el);
  }
  window.creditStrip = { decorate };

  function place() {
    if (!cur) return;
    const kids = host.children, i = idx(cur);
    const gap = parseFloat(getComputedStyle(host).columnGap) || 0;
    const colW = (host.clientWidth - gap * (COLS - 1)) / COLS;
    const pitch = kids[i + COLS].offsetTop - cur.offsetTop;
    const h = cur.offsetHeight;
    cur.style.setProperty("--cx", (-(colW + gap) * MIDDLE) + "px");        // slide into the left column
    orange.style.setProperty("--slide", (colW + gap) + "px");              // how far the other blocks slide
    panel.style.setProperty("--h", h + "px");
    panel.style.setProperty("--gap", (pitch - h) + "px");
    panel.style.left = (host.offsetLeft + (colW + gap)) + "px";            // right of the left column
    panel.style.width = (colW * 2 + gap) + "px";
    panel.style.top = (host.offsetTop + cur.offsetTop) + "px";
  }

  function apply() {
    const on = stageEl.dataset.page === "credits" && orange.offsetWidth > 0 && orange.offsetHeight > 0;
    const el = on ? pick() : null;
    if (el !== cur) { setOpen(false); clearMarks(); cur = el; }
    if (!cur) { panel.classList.remove("on"); return; }

    // journal.js strips role / tabindex on every re-render: put them back each time
    cur.dataset.credit = TITLE;
    cur.setAttribute("role", "button");
    cur.tabIndex = 0;
    cur.setAttribute("aria-label", TITLE);
    cur.setAttribute("aria-expanded", isOpen ? "true" : "false");
    markZone();
    place();
    panel.classList.add("on");
  }

  /* ---------- open / close ---------- */
  let busy = false;

  // closing: the blocks glide back (see the CSS), then give a small, soft settle wobble as they land
  function settle() {
    const items = zone.concat(cur ? [cur] : []);
    items.forEach(z => {
      if (!z.animate) return;
      const n = idx(z), dir = n % 2 ? 1 : -1;
      const amp = z.offsetWidth * 0.035 * dir, tilt = dir * 0.35;
      const d = z === cur ? 0 : Number(z.style.getPropertyValue("--d")) || 0;
      z.animate([
        { transform: "translateX(0) rotate(0deg)",                                       offset: 0,  easing: "ease-out" },
        { transform: "translateX(" + amp + "px) rotate(" + tilt + "deg)",                offset: .4, easing: "ease-in-out" },
        { transform: "translateX(" + (-amp * .4) + "px) rotate(" + (-tilt * .4) + "deg)", offset: .75, easing: "ease-out" },
        { transform: "translateX(0) rotate(0deg)",                                       offset: 1 }
      ], { duration: 420, delay: 560 + d * 45 });
    });
  }

  function setOpen(v) {
    if (v === isOpen) return;
    if (v) { if (!cur) return; place(); }
    isOpen = v;
    orange.classList.toggle("credit-open", v);
    if (!v) settle();
    if (cur) cur.setAttribute("aria-expanded", v ? "true" : "false");
  }

  // click: a small wind-up, THEN everything straightens, the strip slides into the column and the credits write in
  function play() {
    if (!cur || busy) return;
    if (isOpen) { setOpen(false); return; }
    const el = cur;
    const dx = el.offsetWidth * 0.16;
    busy = true;
    el.setAttribute("data-credit-busy", "");
    const done = () => {
      busy = false;
      el.removeAttribute("data-credit-busy");
      if (el === cur) setOpen(true);
    };
    if (!el.animate) return done();
    const a = el.animate([
      { transform: "translateX(0)",                  offset: 0,   easing: "ease-out" },
      { transform: "translateX(" + dx + "px)",       offset: .4,  easing: "ease-in-out" },
      { transform: "translateX(" + (-dx * .3) + "px)", offset: .75, easing: "ease-out" },
      { transform: "translateX(0)",                  offset: 1 }
    ], { duration: 560 });
    a.onfinish = done;
    a.oncancel = done;

    // the surrounding blocks shake too (same wind-up, a little smaller, each one with its own direction
    // and size so it looks like a ripple rather than one rigid block). Uses `transform`, so it adds on top
    // of the resting scatter (rotate / translate) without fighting it.
    zone.forEach(z => {
      if (!z.animate) return;
      const n = idx(z);
      const dir = n % 2 ? 1 : -1;
      const amp = z.offsetWidth * (0.11 + rnd(n, 4) * 0.11) * dir;
      const tilt = dir * (1.3 + rnd(n, 5) * 1.4);
      z.animate([
        { transform: "translateX(0) rotate(0deg)",                                          offset: 0,   easing: "ease-out" },
        { transform: "translateX(" + amp + "px) rotate(" + tilt + "deg)",                   offset: .25, easing: "ease-in-out" },
        { transform: "translateX(" + (-amp * .7) + "px) rotate(" + (-tilt * .7) + "deg)",   offset: .55, easing: "ease-in-out" },
        { transform: "translateX(" + (amp * .3) + "px) rotate(" + (tilt * .3) + "deg)",     offset: .8,  easing: "ease-out" },
        { transform: "translateX(0) rotate(0deg)",                                          offset: 1 }
      ], { duration: 560 });
    });
  }

  const strip = e => e.target.closest && e.target.closest("#oBlocks > i");
  host.addEventListener("click", e => { if (stageEl.dataset.page === "credits" && strip(e) === cur) play(); });
  document.addEventListener("click", e => {                  // a click anywhere else closes it
    if (isOpen && !(e.target.closest && e.target.closest("#oBlocks > i[data-credit]"))) setOpen(false);
  });
  host.addEventListener("keydown", e => {
    if (e.target !== cur) return;
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); play(); }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") setOpen(false); });

  /* ---------- keep it right when things change ---------- */
  let t;
  const soon = () => { clearTimeout(t); t = setTimeout(apply, 60); };

  // journal.js re-renders the strips (new entry, delete, ...): re-pick and re-mark
  new MutationObserver(soon).observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-act"] });
  window.addEventListener("resize", soon);

  // the page changes (sheets slide for a while): check again once they have settled
  let lastPage = null, lastSize = "";
  setInterval(() => {
    const size = orange.offsetWidth + "x" + orange.offsetHeight + "x" + stageEl.clientHeight;
    if (stageEl.dataset.page !== lastPage || size !== lastSize) {
      lastPage = stageEl.dataset.page; lastSize = size;
      apply();
    }
  }, 300);

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(soon);
  window.addEventListener("load", soon, { once: true });
  apply();
})();
