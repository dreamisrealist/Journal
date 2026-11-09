/* =========================
   LIVE MENU OVERVIEW
   Each sheet in the Menu overview is a scaled-down copy of the real page (same
   markup, same CSS), so it shows what is on the page right now: your latest
   entries, the people, the scrolling strip, the live halftone flower.
   Own file on purpose: it needs nothing from script.js, and if it ever fails the
   old static sheets simply stay in place.
========================= */

(() => {
  const stageEl = document.querySelector("#stage");
  const ov = document.querySelector("#overview");
  const menu = document.querySelector(".nav-menu");
  if (!stageEl || !ov) return;

  // which real sheet each overview column copies, and how wide that sheet is on the stage
  const SRC = { about: "card-grey", books: "card-white", credits: "card-orange", contacts: "card-cream" };
  const FRAC = { about: 0.575, books: 0.40, credits: 0.486, contacts: 0.246 };   // sheet width / stage width
  const source = p => [...stageEl.children].find(el => el.classList.contains(SRC[p]));
  const isOpen = () => document.body.classList.contains("overview-open");

  function copyCanvases(src, clone) {
    const a = src.querySelectorAll("canvas"), b = clone.querySelectorAll("canvas");
    if (a.length !== b.length) return false;
    a.forEach((c, i) => {
      if (b[i].width !== c.width) { b[i].width = c.width; b[i].height = c.height; }
      b[i].getContext("2d").drawImage(c, 0, 0);
    });
    return true;
  }

  const phone = window.matchMedia("(max-width: 768px)");

  function build() {
    // on phones the page is a different layout (the white and orange sheets are hidden), so a scaled copy
    // would not match: keep the simple static sheets there
    if (phone.matches) {
      ov.querySelectorAll(".ov-sheet.live").forEach(s => { s.classList.remove("live"); const m = s.querySelector(".ov-mini"); if (m) m.remove(); });
      return;
    }
    const sw = stageEl.clientWidth, sh = stageEl.clientHeight;
    if (!sw || !sh) return;
    ov.querySelectorAll(".ov-col[data-page]").forEach(col => {
      const p = col.dataset.page, src = source(p), sheet = col.querySelector(".ov-sheet");
      if (!src || !sheet || !FRAC[p]) return;
      const w = sheet.clientWidth;
      if (!w) return;

      // copy of the real sheet, cleaned up the same way the left-hand thumbnails are
      const clone = src.cloneNode(true);
      clone.removeAttribute("style"); clone.classList.remove("open");
      ["data-depth", "aria-hidden"].forEach(a => clone.removeAttribute(a));
      clone.querySelectorAll("[id],[name]").forEach(n => { n.removeAttribute("id"); n.removeAttribute("name"); });
      clone.querySelectorAll("a,button,input,[tabindex]").forEach(n => { n.tabIndex = -1; });
      clone.querySelectorAll(".rip,.go").forEach(n => n.classList.remove("rip", "go"));
      clone.querySelectorAll(".feature-shake").forEach(n => n.classList.remove("feature-shake"));   // never copy a half-played animation
      if (p === "credits" && src.style.height) clone.style.height = src.style.height;
      if (p === "contacts") clone.style.height = "36cqh";

      // .ov-mini is a stage-sized box (so the sheet's cqw / cqh / --u units come out exactly as on the
      // real stage), scaled down to fit the column
      const refW = sw * FRAC[p];
      // the contact preview box must have the same proportions as the real contact card, or its details get cut off
      if (p === "contacts") sheet.style.aspectRatio = refW + " / " + (sh * 0.36);
      const wrap = document.createElement("span");
      wrap.className = "mini ov-mini";
      wrap.setAttribute("aria-hidden", "true");
      wrap.style.width = sw + "px";
      wrap.style.height = sh + "px";
      wrap.style.transform = "scale(" + (w / refW) + ")";
      const inner = document.createElement("div");
      inner.className = "mini-inner";
      inner.style.width = refW + "px";
      inner.append(clone);
      wrap.append(inner);

      const old = sheet.querySelector(".ov-mini");
      if (old) old.remove();
      sheet.prepend(wrap);
      sheet.classList.add("live");
      copyCanvases(src, clone);
    });
    barPairs = null;                                   // re-pair the book bars with the fresh copy
  }

  // the Memories bars sway on a script.js ticker that only moves the real ones: mirror their inline
  // animation values onto the copy every frame while the overview is open
  let barPairs = null;
  const getPairs = () => {
    const a = document.querySelectorAll("#stage > .card-white .w-bars i");
    const b = ov.querySelectorAll(".ov-mini .w-bars i");
    if (!a.length || a.length !== b.length) return [];
    return [...a].map((el, i) => [el, b[i]]);
  };
  const mirrorBars = () => {
    if (isOpen() && !document.hidden) {
      if (!barPairs || !barPairs.length) barPairs = getPairs();
      barPairs.forEach(([s, d]) => {
        d.style.translate = s.style.translate;
        d.style.scale = s.style.scale;
        d.style.rotate = s.style.rotate;
        d.style.backgroundColor = s.style.backgroundColor;
      });
    }
    requestAnimationFrame(mirrorBars);
  };
  requestAnimationFrame(mirrorBars);

  // keep the live canvases (the halftone flower) moving while the overview is open
  setInterval(() => {
    if (!isOpen() || document.hidden) return;
    ov.querySelectorAll(".ov-col[data-page]").forEach(col => {
      const clone = col.querySelector(".ov-mini .card"), src = source(col.dataset.page);
      if (clone && src && !copyCanvases(src, clone)) build();
    });
  }, 150);

  // strip icons in the preview: hover lifts the icon (pure CSS), click plays the ripple + the icon's own move,
  // same as on the real page. A click on an icon only plays the animation; the rest of the sheet still opens the page.
  const cellOf = e => e.target.closest && e.target.closest(".ov-mini .band-track > span");
  ov.addEventListener("click", e => {
    const c = cellOf(e);
    if (!c) return;
    e.preventDefault(); e.stopPropagation();
    c.classList.remove("rip", "go");
    void c.offsetWidth;                       // restart if clicked again quickly
    c.classList.add("rip", "go");
  }, true);
  ov.addEventListener("animationend", e => {
    const c = cellOf(e);
    if (!c) return;
    if (e.animationName === "stripRipple") c.classList.remove("rip");
    else c.classList.remove("go");
  });

  // always fresh when it opens
  if (menu) menu.addEventListener("click", build, true);

  // and if the page text changes while it is open (new entry saved, list refilled), rebuild once things settle
  let mt;
  new MutationObserver(() => {
    if (!isOpen()) return;
    clearTimeout(mt); mt = setTimeout(build, 400);
  }).observe(stageEl, { childList: true, subtree: true, characterData: true });

  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(build, 150); });
  const again = () => { build(); setTimeout(build, 1500); };
  if (document.readyState === "complete") again(); else window.addEventListener("load", again, { once: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
  build();
})();
