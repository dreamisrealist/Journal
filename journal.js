/* =========================
   JOURNAL
   - Entries are written on the ENTRIES page (the orange sheet): its first strip is
     "+ New entry", every entry is a strip you click to edit or delete (photos, clips and a
     free-text label like Journal, Memory, Passion, Practice, anything).
   - The cream card is contact only. The Memories board is read-only.
   - Front page ("Latest Entries") shows the 8 newest; your sample entries only
     fill the empty slots and disappear as real ones arrive.
   - Memories page lists every entry, 10 per page. A new page is created
     automatically when the last one is full.
   - Click an entry on the board to read it (view only).
   Entries live in Supabase (public read, only the owner account can write):
   text in the `entries` table, photos/videos in the public `media` bucket.
========================= */

(() => {
  const KEY = "journal-entries-v1";
  const PER_PAGE = 10;          // rows per Memories page
  const FRONT_MAX = 8;          // rows on the front page

  const frontList = document.querySelector("#stage > .card-grey .book-list");
  const memList = document.querySelector("#stage > .card-white .card-list");
  if (!frontList || !memList) return;

  // the sample rows written in index.html: used only to fill empty slots
  const fillerFront = [...frontList.children];
  const fillerMem = [...memList.children];

  // "Notes to self" on the front page: only real entries, nothing when there are none
  const quotesEl = document.querySelector("#stage > .card-grey .quotes");
  const QUOTES_MAX = 3;

  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const todayISO = () => {
    const d = new Date(), z = n => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate());
  };
  const normDate = (v, fallback) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v || "")) return v;
    const t = Date.parse(v || "");
    if (!isNaN(t)) { const d = new Date(t), z = n => String(n).padStart(2, "0"); return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate()); }
    return fallback || todayISO();
  };
  const fmt = (iso, year) => {
    const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(iso || "");
    return m ? MON[+m[2] - 1] + " " + (+m[3]) + (year ? ", " + m[1] : "") : (iso || "");
  };


  /* ---------- storage ---------- */

  // serial number like the reference's ISBN: DRM-11: + 10 random digits, one per entry
  const newSerial = () => {
    let s;
    do { s = String(1 + Math.floor(Math.random() * 9)); for (let i = 0; i < 9; i++) s += Math.floor(Math.random() * 10); }
    while (entries.some(e => e.serial === s));
    return s;
  };

  let entries = [];

  /* ---- cloud (Supabase) ---- */
  const cfg = window.JOURNAL_CLOUD || {};
  const sb = window.__sb || ((window.supabase && cfg.url && cfg.key && !/YOUR-/.test(cfg.url)) ? window.supabase.createClient(cfg.url, cfg.key) : null);
  const BUCKET = "media";
  let owner = false;                      // true only when the owner is logged in (the database enforces it too)
  const mediaURL = id => sb ? sb.storage.from(BUCKET).getPublicUrl(id).data.publicUrl : "";
  const fail = err => { console.error(err); try { stateEl.textContent = "Not saved ✗ (are you logged in?)"; } catch (e) {} };

  const fix = e => {                       // tidy an entry (older ones had a Journal / Memory switch)
    if (typeof e.label !== "string") { e.label = e.kind === "memory" ? "Memory" : "Journal"; delete e.kind; }
    if (!e.serial) e.serial = newSerial();
    if (!Array.isArray(e.media)) e.media = [];
    return e;
  };
  const isBlank = e => !((e.title || "").trim() || (e.text || "").trim() || e.media.length);

  const persist = en => {                  // save ONE entry (owner only)
    if (!owner || !sb || !en) return;
    sb.from("entries").upsert({ id: en.id, data: en, updated_at: new Date().toISOString() }).then(r => { if (r.error) fail(r.error); });
  };
  const removeEntry = en => {
    if (!owner || !sb || !en) return;
    sb.from("entries").delete().eq("id", en.id).then(r => { if (r.error) fail(r.error); });
  };

  async function loadCloud() {
    if (!sb) return;
    const r = await sb.from("entries").select("data");
    if (r.error) { console.warn("Could not load entries:", r.error); return; }
    entries = r.data.map(x => x.data).filter(Boolean).map(fix).filter(e => !isBlank(e));
    render();
  }

  // photos & clips: Supabase Storage (public bucket). Old local copies (IndexedDB) are only read for the one-time upload.
  const blobs = new Map();
  const dbp = new Promise(res => {
    try {
      const r = indexedDB.open("journal-media", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("media", { keyPath: "id" });
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch (e) { res(null); }
  });
  const idb = (mode, fn) => dbp.then(db => !db ? undefined : new Promise(res => {
    try {
      const t = db.transaction("media", mode), r = fn(t.objectStore("media"));
      t.oncomplete = () => res(r && r.result);
      t.onerror = t.onabort = () => res(undefined);
    } catch (e) { res(undefined); }
  }));
  const putBlob = async (id, blob) => {
    blobs.set(id, blob);
    if (!owner || !sb) return;
    const r = await sb.storage.from(BUCKET).upload(id, blob, { upsert: true, contentType: blob.type });
    if (r.error) fail(r.error);
  };
  const delBlob = id => { blobs.delete(id); if (owner && sb) sb.storage.from(BUCKET).remove([id]); };
  const getBlob = async id => {
    if (blobs.has(id)) return blobs.get(id);
    try { const r = await fetch(mediaURL(id)); if (!r.ok) return undefined; const b = await r.blob(); blobs.set(id, b); return b; }
    catch (e) { return undefined; }
  };

  // one-time: entries that were written in THIS browser before the cloud existed
  async function migrateLocal() {
    let local = [];
    try { local = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) {}
    local = (Array.isArray(local) ? local : []).filter(e => e && e.id && !entries.some(x => x.id === e.id));
    if (!local.length || !confirm("Upload " + local.length + " entr" + (local.length > 1 ? "ies" : "y") + " from this browser to your cloud journal?")) return;
    for (const raw of local) {
      const en = fix(raw);
      if (isBlank(en)) continue;
      for (const m of en.media) {
        const rec = await idb("readonly", s => s.get(m.id));
        if (rec && rec.blob) await putBlob(m.id, rec.blob);
      }
      entries.push(en);
      const r = await sb.from("entries").upsert({ id: en.id, data: en });
      if (r.error) { fail(r.error); return; }
    }
    try { localStorage.setItem(KEY + "-uploaded", localStorage.getItem(KEY)); localStorage.removeItem(KEY); } catch (e) {}
    render();
  }

  /* ---- owner login: open the site with ?owner at the end of the address ---- */
  async function initAuth() {
    if (!sb) return;
    const s = await sb.auth.getSession();
    owner = !!(s.data && s.data.session);
    if (owner) {                                       // "Owner · Log out" lives in the Menu overview, top left
      const ov = document.querySelector("#overview");
      if (ov && !ov.querySelector(".ov-owner")) {
        const st = document.createElement("style");
        st.textContent =
          ".ov-owner { position: absolute; top: 24px; right: calc(28px + 4.6em); display: inline-flex; align-items: center; gap: 8px; padding: 0; background: none; border: 0; color: inherit; cursor: pointer; font-family: inherit; font-weight: 700; font-size: clamp(14px, 0.92vw, 22px); line-height: 1; letter-spacing: -0.02em; outline: none; }" +
          ".ov-owner i { font-style: normal; font-weight: 600; font-size: .8em; line-height: 1; padding: .25em .6em; border: 1px solid currentColor; border-radius: 99px; }" +
          ".ov-owner span { position: relative; }" +
          ".ov-owner span::after { content: ''; position: absolute; left: 0; right: 0; bottom: -3px; height: 2px; background: currentColor; transform: scaleX(0); transform-origin: right center; transition: transform .3s ease; }" +
          ".ov-owner:hover span::after, .ov-owner:focus-visible span::after { transform: scaleX(1); transform-origin: left center; }" +
          ".ov-owner:hover i, .ov-owner:focus-visible i { background: #e0562c; border-color: #e0562c; color: #fff; }";
        document.head.append(st);
        const b = document.createElement("button");
        b.type = "button"; b.className = "ov-owner";
        b.innerHTML = "<i>Owner</i><span>Log out</span>";
        b.addEventListener("click", () => sb.auth.signOut().then(() => location.reload()));
        ov.append(b);
      }
    }
  }
  const showLogin = () => { if (window.ownerLogin) window.ownerLogin.show(false); };   // the themed box lives in login.js
  const labelOf = en => (en.label || "").trim() || "Entry";


  /* ---------- the two lists ---------- */

  const sorted = () => entries.slice().sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);
  const mediaText = en => {
    const p = en.media.filter(m => m.type === "image").length, v = en.media.length - p, out = [];
    if (p) out.push(p + (p > 1 ? " photos" : " photo"));
    if (v) out.push(v + (v > 1 ? " clips" : " clip"));
    return out.join(" · ");
  };

  // the small bracket under a title: (Author, Year), the year taken from the entry's date
  const yearOf = en => ((en && en.date) || "").slice(0, 4);
  const bracketOf = en => {
    const a = (en.author || "").trim(), y = yearOf(en);
    return "(" + [a, y].filter(Boolean).join(", ") + ")";
  };

  function realRow(en, n, front) {
    const li = document.createElement("li");
    li.className = "real"; li.tabIndex = 0; li.dataset.id = en.id;
    li.setAttribute("role", "button");
    const num = document.createElement("i"), box = document.createElement("span");
    const b = document.createElement("b"), s = document.createElement("small");
    b.textContent = en.title || "Untitled";
    const kind = labelOf(en);
    s.textContent = bracketOf(en);
    num.textContent = n;
    box.append(b, s);
    if (front) li.append(box, num);
    else {
      const em = document.createElement("em"); em.textContent = kind;
      li.append(num, box, em);
    }
    return li;
  }

  // a short quote from an entry's own text: whole sentences if they fit, otherwise cut at a word
  const excerpt = text => {
    const t = (text || "").replace(/\s+/g, " ").trim();
    if (t.length <= 170) return t;
    let cut = t.slice(0, 170);
    const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    if (stop >= 70) return cut.slice(0, stop + 1);
    cut = cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:—-]+$/, "");
    return cut + "…";
  };

  function renderQuotes(list) {
    if (!quotesEl) return;
    const clip = quotesEl.querySelector(".q-clip");
    const real = list.filter(en => (en.text || "").trim()).slice(0, QUOTES_MAX).map(en => {
      const bq = document.createElement("blockquote");
      const c = document.createElement("cite"), p = document.createElement("p"), b = document.createElement("b");
      c.textContent = fmt(en.date) + ":";
      p.textContent = "\u201C" + excerpt(en.text) + "\u201D";
      b.textContent = (en.title || "").trim() || labelOf(en);
      bq.append(c, p, b);
      return bq;
    });
    const all = real;                                   // no samples: with no entries the notes stay empty
    quotesEl.querySelectorAll("blockquote").forEach(q => q.remove());
    all.forEach(q => clip ? clip.before(q) : quotesEl.append(q));
    const n = quotesEl.querySelector(".q-title small");
    if (n) n.textContent = "(" + all.length + ")";
  }

  let page = 0;
  let onChange = () => {};      // the Entries manager refreshes itself through this
  const pager = document.createElement("div");
  pager.className = "pager";
  memList.after(pager);

  const pageButtons = (cur, total) => {
    const out = [], show = new Set([0, total - 1, cur - 1, cur, cur + 1]);
    let gap = false;
    for (let i = 0; i < total; i++) {
      if (!show.has(i)) { if (!gap) out.push("…"); gap = true; continue; }
      gap = false; out.push(i);
    }
    return out;
  };

  function render() {
    const list = sorted();

    // front page: newest real entries first, samples only fill what is left
    const front = list.slice(0, FRONT_MAX).map((en, i) => realRow(en, i + 1, true));
    fillerFront.slice(0, FRONT_MAX - front.length).forEach(f => front.push(f));
    front.forEach((li, i) => { const n = li.querySelector("i"); if (n && !li.classList.contains("real")) n.textContent = i + 1; });
    frontList.replaceChildren(...front);
    renderQuotes(list);

    // memories page: every entry, PER_PAGE per page; pages are created as needed
    const all = list.map((en, i) => realRow(en, i + 1, false));
    fillerMem.slice(0, Math.max(0, PER_PAGE - all.length)).forEach(f => all.push(f));
    all.forEach((li, i) => { if (!li.classList.contains("real")) li.querySelector("i").textContent = i + 1; });
    const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
    page = Math.min(page, pages - 1);
    memList.replaceChildren(...all.slice(page * PER_PAGE, (page + 1) * PER_PAGE));

    // pager
    pager.textContent = "";
    const nav = document.createElement("div");
    nav.className = "pg-nav";
    const label = document.createElement("span");
    label.className = "pg-label"; label.textContent = "Page " + (page + 1) + " / " + pages;
    nav.append(label);
    if (pages > 1) {
      const mk = (txt, to, cls, dis) => {
        const b = document.createElement("button");
        b.type = "button"; b.textContent = txt; b.dataset.page = to; b.className = cls || "";
        if (dis) b.disabled = true;
        return b;
      };
      nav.append(mk("←", page - 1, "pg-arrow", page === 0));
      pageButtons(page, pages).forEach(p => {
        if (p === "…") { const s = document.createElement("span"); s.className = "pg-dots"; s.textContent = "…"; nav.append(s); }
        else nav.append(mk(String(p + 1), p, p === page ? "on" : ""));
      });
      nav.append(mk("→", page + 1, "pg-arrow", page === pages - 1));
    }
    pager.append(nav);

    // the sheets changed height: refresh the scroll length and the little previews
    const pic = document.querySelector("#hoverPic"); if (pic) pic.classList.remove("on");
    if (typeof layoutScroll === "function") layoutScroll();
    clearTimeout(render.t);
    render.t = setTimeout(() => { if (!window.__pageBusy && window.rebuildThumbs) window.rebuildThumbs(); }, 120);
    onChange();
  }

  pager.addEventListener("click", e => {
    if (document.body.classList.contains("drawing")) return;
    if (e.target.closest(".pg-new")) {
      e.stopPropagation();
      if (typeof goToPage === "function") goToPage("credits");   // the Entries page
      return;
    }
    const b = e.target.closest("button[data-page]");
    if (!b || b.disabled) return;
    e.stopPropagation();
    page = +b.dataset.page;
    render();
  });

  const openFromList = e => {
    if (document.body.classList.contains("drawing")) return;
    const li = e.target.closest("li.real");
    if (!li) return;
    if (e.type === "keydown") { if (e.key !== "Enter" && e.key !== " ") return; e.preventDefault(); }
    open(li.dataset.id, false, "view");
  };
  [frontList, memList].forEach(l => { l.addEventListener("click", openFromList); l.addEventListener("keydown", openFromList); });


  /* ---------- the entry editor ---------- */

  const root = document.createElement("div");
  root.className = "je";
  root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Journal entry");
  root.innerHTML =
    '<div class="je-loader" aria-hidden="true"><div class="pixel-loader"></div></div>' +
    '<div class="je-sheet">' +
      '<header class="je-top">' +
        '<span class="je-dots" aria-hidden="true"><i></i><i></i></span>' +
        '<span class="je-lab">Entry</span>' +
        '<span class="je-state" aria-live="polite">Saved ✓</span>' +
        '<button type="button" class="je-close"><span class="je-cl">Close</span> <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1.5 1.5l9 9M10.5 1.5l-9 9" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></button>' +
      '</header>' +
      '<section class="je-hero">' +
        '<textarea class="je-title" rows="1" maxlength="60" placeholder="Title" aria-label="Title"></textarea>' +
        '<input type="text" class="je-tag" maxlength="24" placeholder="Label (Passion, Practice…)" aria-label="Label">' +
      '</section>' +
      '<section class="je-body">' +
        '<div class="je-c1"><input class="je-date" type="date" aria-label="Date"><input class="je-author" type="text" maxlength="40" placeholder="Author (who wrote it)" aria-label="Author"><span class="je-meta"></span></div>' +
        '<div class="je-c2"><input class="je-tagline" type="text" maxlength="60" placeholder="A line to remember it by" aria-label="Short line"><textarea class="je-text" placeholder="Write about this day…" aria-label="Description"></textarea></div>' +
        '<div class="je-c3"><span class="je-count"></span></div>' +
      '</section>' +
      '<section class="je-media">' +
        '<div class="je-bar">' +
          '<label class="je-btn">+ Add photos<input class="je-photos" type="file" accept="image/*" multiple hidden></label>' +
          '<label class="je-btn">+ Add clips<input class="je-clips" type="file" accept="video/*" multiple hidden></label>' +
          '<span class="je-note"></span>' +
        '</div>' +
        '<div class="je-grid"></div>' +
      '</section>' +
      '<footer class="je-foot">' +
        '<button type="button" class="je-save">Save <svg viewBox="0 0 16 10" aria-hidden="true"><path d="M0 5h14M10 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></button>' +
        '<button type="button" class="je-del">Delete</button>' +
      '</footer>' +
    '</div>';
  document.body.append(root);
  gsap.set(root, { autoAlpha: 0 });

  const q = s => root.querySelector(s);
  // the dim lives inside the stage, so it covers every sheet + the thumbnails but not the logo, nav or emblem
  const dim = document.createElement("div");
  dim.className = "je-dim";
  document.querySelector("#stage").append(dim);
  const loaderEl = q(".je-loader"), pix = q(".pixel-loader");
  const sheet = q(".je-sheet"), titleIn = q(".je-title"), dateIn = q(".je-date"), authorIn = q(".je-author"), textIn = q(".je-text");
  const stateEl = q(".je-state"), grid = q(".je-grid"), delBtn = q(".je-del"), note = q(".je-note");
  const labEl = q(".je-lab"), taglineIn = q(".je-tagline"), metaEl = q(".je-meta"), tagBtn = q(".je-tag"), countEl = q(".je-count"), saveBtn = q(".je-save");

  let cur = null, urls = [], saveT = null, delT = null, isOpen = false, mode = "edit";
  const sizeTag = () => { tagBtn.style.width = Math.max(6, (tagBtn.value || tagBtn.placeholder).length + 2) + "ch"; };
  const setLabel = v => { tagBtn.value = v; sizeTag(); };
  const fit = (el, min) => { el.style.height = "auto"; el.style.height = Math.max(el.scrollHeight, min) + "px"; };
  const grow = () => { fit(textIn, mode === "view" ? 0 : 170); fit(titleIn, 0); if (window.__jeLock && typeof measure === "function") measure(); };
  const showCount = () => { countEl.textContent = cur ? "DRM-11: " + cur.serial : ""; };
  const showMeta = () => {
    metaEl.textContent = cur ? bracketOf(cur) : "";
  };

  function commit() {
    if (!cur || mode !== "edit") return;
    cur.title = titleIn.value.trim() || "Untitled";
    cur.date = normDate(dateIn.value, cur.date);
    cur.author = authorIn.value.trim();
    cur.label = tagBtn.value.trim();
    cur.text = textIn.value;
    cur.tagline = taglineIn.value.trim();
    persist(cur);
    stateEl.textContent = "Saved ✓";
  }
  const touch = () => { stateEl.textContent = "Saving…"; clearTimeout(saveT); saveT = setTimeout(commit, 350); };

  /* black diamond dots on a 45deg screen over a paper-grey ground (dark = big dots, light = none) */
  function drawHalftone(img, cv) {
    const maxW = 1100, k = Math.min(1, maxW / img.naturalWidth);
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const a = document.createElement("canvas"); a.width = w; a.height = h;
    const actx = a.getContext("2d", { willReadFrequently: true });
    actx.fillStyle = "#fff"; actx.fillRect(0, 0, w, h);
    actx.drawImage(img, 0, 0, w, h);
    const px = actx.getImageData(0, 0, w, h).data;
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#c9c8bc"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#3b3b39"; ctx.beginPath();
    const P = Math.max(7, Math.round(w / 85)), t = P / 3;
    const ang = Math.PI / 4, cos = Math.cos(ang), sin = Math.sin(ang), diag = Math.hypot(w, h);
    const S = [[-t,-t],[0,-t],[t,-t],[-t,0],[0,0],[t,0],[-t,t],[0,t],[t,t]];
    for (let u = -diag; u < diag; u += P) {
      for (let v = -diag; v < diag; v += P) {
        const cx = w / 2 + u * cos - v * sin, cy = h / 2 + u * sin + v * cos;
        if (cx < -P || cy < -P || cx > w + P || cy > h + P) continue;
        let lum = 0;
        for (const [dx, dy] of S) {
          const x = Math.min(w - 1, Math.max(0, Math.round(cx + dx))), y = Math.min(h - 1, Math.max(0, Math.round(cy + dy)));
          const i = (y * w + x) * 4;
          lum += (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
        }
        const cov = Math.min(1, Math.max(0, (1 - lum / S.length - 0.06) * 1.3));
        if (cov < 0.05) continue;
        const r = P * Math.sqrt(cov) * 0.74;
        const ux = cos * r, uy = sin * r, vx = -sin * r, vy = cos * r;
        ctx.moveTo(cx - ux - vx, cy - uy - vy); ctx.lineTo(cx + ux - vx, cy + uy - vy);
        ctx.lineTo(cx + ux + vx, cy + uy + vy); ctx.lineTo(cx - ux + vx, cy - uy + vy); ctx.closePath();
      }
    }
    ctx.fill();
  }

  // the little clipped note on a photo: write a quote (edit mode); read-only, and hidden when empty, in view mode
  function quoteNote(m) {
    const card = document.createElement("div");
    card.className = "je-qnote";
    const clip = document.createElement("span"); clip.className = "je-qclip"; clip.setAttribute("aria-hidden", "true");
    const mark = document.createElement("span"); mark.className = "je-qmark"; mark.setAttribute("aria-hidden", "true"); mark.innerHTML = '<svg viewBox="1 1 32 21" height="26" aria-hidden="true" focusable="false" style="display:block;height:26px;width:auto;fill:currentColor"><path d="M1.2 15.2C1.2 7.6 5.6 2.2 12.6 1.2L13.6 4.7C10.3 5.6 8.7 7.4 8.3 9.6 11.9 9.9 14 12.4 14 15.5 14 19 11.4 21.8 7.6 21.8 3.6 21.8 1.2 19 1.2 15.2Z"/><path d="M19.8 15.2C19.8 7.6 24.2 2.2 31.2 1.2L32.2 4.7C28.9 5.6 27.3 7.4 26.9 9.6 30.5 9.9 32.6 12.4 32.6 15.5 32.6 19 30 21.8 26.2 21.8 22.2 21.8 19.8 19 19.8 15.2Z"/></svg>';
    const ta = document.createElement("textarea");
    ta.className = "je-qtext"; ta.rows = 1; ta.maxLength = 140; ta.placeholder = "Write a quote…"; ta.setAttribute("aria-label", "Quote");
    ta.value = m.quote || ""; ta.readOnly = mode === "view";
    if (mode === "view" && !ta.value.trim()) card.hidden = true;
    ta.addEventListener("input", () => { m.quote = ta.value; fit(ta, 0); touch(); });
    ta.addEventListener("keydown", e => { if (e.key === "Enter") e.preventDefault(); });
    card.append(clip, mark, ta);
    requestAnimationFrame(() => fit(ta, 0));
    setTimeout(() => fit(ta, 0), 900);              // again once the sheet has finished rising
    return card;
  }

  async function renderMedia() {
    urls.forEach(u => URL.revokeObjectURL(u)); urls = [];
    const en = cur;
    const list = await Promise.all(en.media.map(async m => ({ m, blob: m.type === "video" ? null : await getBlob(m.id) })));
    if (cur !== en) return;
    grid.textContent = ""; showCount();
    list.forEach(({ m, blob }) => {
      const fig = document.createElement("figure");
      fig.className = "je-item";
      if (blob || m.type === "video") {
        if (m.type === "video") {
          const el = document.createElement("video"); el.controls = true; el.preload = "metadata"; el.playsInline = true;
          el.src = blobs.has(m.id) ? (() => { const u = URL.createObjectURL(blobs.get(m.id)); urls.push(u); return u; })() : mediaURL(m.id);
          fig.append(el);
        } else {
          const url = URL.createObjectURL(blob); urls.push(url);
          // photos turn into the black-dot halftone automatically, with a little clipped note for a quote
          fig.classList.add("photo");
          const cv = document.createElement("canvas");
          cv.setAttribute("role", "img"); cv.setAttribute("aria-label", m.name || "Photo");
          fig.append(cv);
          const im = new Image();
          im.onload = () => { try { drawHalftone(im, cv); } catch (e) { fig.classList.add("raw"); im.className = "je-raw"; fig.prepend(im); cv.remove(); } };
          im.src = url;
          fig.append(quoteNote(m));
        }
      } else {
        const miss = document.createElement("span");
        miss.className = "je-miss"; miss.textContent = "File not found";
        fig.append(miss);
      }
      const x = document.createElement("button");
      x.type = "button"; x.className = "je-x"; x.setAttribute("aria-label", "Remove"); x.textContent = "×";
      x.addEventListener("click", async () => {
        en.media = en.media.filter(k => k.id !== m.id);
        persist(en); delBlob(m.id); renderMedia(); render();
      });
      if (mode === "edit") fig.append(x);
      grid.append(fig);
    });
  }

  async function addFiles(files, type) {
    if (!cur) return;
    const en = cur;
    stateEl.textContent = "Adding…";
    for (const f of files) {
      if (!f.type.startsWith(type + "/")) continue;
      const id = uid("m");
      await putBlob(id, f);
      en.media.push({ id, type, name: f.name });
    }
    persist(en);
    if (cur === en) { renderMedia(); stateEl.textContent = "Saved ✓"; }
    render();
  }
  q(".je-photos").addEventListener("change", e => { addFiles([...e.target.files], "image"); e.target.value = ""; });
  q(".je-clips").addEventListener("change", e => { addFiles([...e.target.files], "video"); e.target.value = ""; });

  /* Opening an entry (same as the reference): the page dims, the 7x7 pixel loader
     plays bottom-left, then the beige sheet rises from below with a little tilt. */
  const FRAMES = [
    ".......\n.#...#.\n.......\n.......\n.......\n.#...#.\n.......",
    "#.....#\n.#...#.\n..#.#..\n.......\n..#.#..\n.#...#.\n#.....#",
    ".##.##.\n##...##\n#.....#\n.......\n#.....#\n##...##\n.##.##.",
    "..#.#..\n.#...#.\n#.....#\n.......\n#.....#\n.#...#.\n..#.#.."
  ].map(f => f.split("\n").join(""));
  for (let i = 0; i < 49; i++) pix.append(document.createElement("i"));
  const pixCells = [...pix.children];
  let pixStep = 0, pixTimer = null, tl = null;
  const drawPix = () => FRAMES[pixStep].split("").forEach((c, i) => pixCells[i].classList.toggle("on", c === "#"));
  const startPix = () => { clearInterval(pixTimer); pixStep = 0; drawPix(); pixTimer = setInterval(() => { pixStep = (pixStep + 1) % FRAMES.length; drawPix(); }, 380); };
  const stopPix = () => clearInterval(pixTimer);

  const LOAD = 1.5;                                   // seconds the loader plays
  const riseY = p => 1 - Math.pow(1 - p, 3.4);
  const riseR = p => 1 - Math.pow(1 - p, 2.2);
  const dropY = p => Math.pow(p, 2.5);

  /* ONE scroll for everything (like the reference): the beige entry is just another sheet of the stack.
     It slides up with the page scroll together with the four sheets and the thumbnails, and they all
     come to rest together (script.js reads window.__jeLock / __jeSheetEl in layoutScroll + updateScroll). */
  const measure = () => { if (window.__jeLock && window.layoutScroll) layoutScroll(); };
  const sheetRO = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
  function lockScroll() {
    window.__jeLock = true; window.__jeSheetEl = sheet;
    if (typeof lenis !== "undefined" && lenis) lenis.start();
    if (sheetRO) { sheetRO.disconnect(); sheetRO.observe(sheet); [...sheet.children].forEach(c => sheetRO.observe(c)); }
    measure();
  }
  function unlockScroll() {
    if (sheetRO) sheetRO.disconnect();
    window.__jeLock = false; window.__jeSheetEl = null;
    sheet.style.translate = "";
    if (typeof lenis !== "undefined" && lenis) lenis.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
    if (window.layoutScroll) layoutScroll();
  }

  // mode "view": read-only (clicking an entry in the lists). mode "edit": only right after writing a new entry.
  function open(id, isNew, how) {
    const en = entries.find(x => x.id === id);
    if (!en || isOpen) return;
    isOpen = true; cur = en; mode = (how === "edit" && owner) ? "edit" : "view";
    const ro = mode === "view";
    sheet.classList.toggle("view", ro);
    titleIn.readOnly = textIn.readOnly = taglineIn.readOnly = tagBtn.readOnly = authorIn.readOnly = ro; dateIn.disabled = ro;
    tagBtn.tabIndex = ro ? -1 : 0;
    root.classList.toggle("edit", !ro);
    labEl.textContent = ro ? "Journal" : "Edit entry";
    textIn.placeholder = ro ? "" : "Write about this day…";
    taglineIn.value = en.tagline || ""; sheet.classList.toggle("no-tag", !en.tagline);
    titleIn.value = en.title; dateIn.value = en.date; authorIn.value = en.author || ""; textIn.value = en.text || ""; setLabel(ro ? labelOf(en) : (en.label || ""));
    stateEl.textContent = "Saved ✓"; delBtn.textContent = "Delete"; delBtn.classList.remove("sure");
    sheet.scrollTop = 0;
    note.textContent = sb ? "" : "Cloud is not set up: nothing will be saved.";
    showMeta(); showCount(); renderMedia();
    document.body.classList.add("je-open");

    if (tl) tl.kill();
    gsap.killTweensOf([root, dim, loaderEl, sheet]);
    gsap.set(root, { autoAlpha: 1 });
    gsap.set(dim, { opacity: 0 });
    gsap.set(loaderEl, { opacity: 0, y: 0 });
    gsap.set(sheet, { y: innerHeight * 1.1, rotation: -3.5, transformOrigin: "50% 0%" });
    startPix();
    requestAnimationFrame(grow);

    // opened while scrolled down: the sheets glide back to their default place during the loading
    const L = typeof lenis !== "undefined" ? lenis : null;
    if (window.scrollY > 4) {
      if (L) L.scrollTo(0, { duration: 0.6, lock: true, easing: t => 1 - Math.pow(1 - t, 3) });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    }

    const LD = ro ? LOAD : 0.2;                  // writing from the manager: no long loader
    tl = gsap.timeline({ onComplete: () => { grow(); if (!ro) titleIn.focus({ preventScroll: true }); } });
    tl.call(() => { lockScroll(); }, null, window.scrollY > 4 ? 0.65 : 0)   // from here the page scroll drives the beige sheet
      .to(dim, { opacity: 1, duration: 0.35, ease: "power2.out" }, 0)
      .to(loaderEl, { opacity: 1, duration: 0.25 }, 0.1)
      .to(loaderEl, { y: 80, opacity: 0, duration: 0.4, ease: "power3.in", onComplete: stopPix }, LD)
      .to(dim, { opacity: 0, duration: 0.8, ease: "power2.out" }, LD + 0.4)
      .to(sheet, { y: 0, duration: 0.85, ease: riseY }, LD + 0.4)
      .to(sheet, { rotation: 0, duration: 0.85, ease: riseR }, LD + 0.4);
  }

  function close() {
    if (!isOpen) return;
    clearTimeout(saveT);
    if (cur && mode === "edit" && !titleIn.value.trim() && !textIn.value.trim() && !taglineIn.value.trim() && !cur.media.length) {
      const blank = cur; entries = entries.filter(x => x !== blank); removeEntry(blank); cur = null;   // nothing was written: don't keep an empty entry
    } else commit();
    isOpen = false;
    document.body.classList.remove("je-open");
    if (window.scrollY > 4) {
      if (typeof lenis !== "undefined" && lenis) lenis.scrollTo(0, { duration: 0.5, lock: true, easing: t => 1 - Math.pow(1 - t, 3) });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (tl) tl.kill();
    stopPix();
    gsap.killTweensOf([root, dim, loaderEl, sheet]);
    gsap.to(dim, { opacity: 0, duration: 0.3 });
    gsap.to(loaderEl, { opacity: 0, duration: 0.15 });
    gsap.to(sheet, { y: innerHeight * 1.1, rotation: 3, duration: 0.5, ease: dropY, onComplete: () => {
      unlockScroll();
      gsap.set(root, { autoAlpha: 0 });
      urls.forEach(u => URL.revokeObjectURL(u)); urls = []; grid.textContent = ""; cur = null;
    } });
    render();
  }

  taglineIn.addEventListener("input", touch);
  titleIn.addEventListener("input", () => { fit(titleIn, 0); touch(); });
  titleIn.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); textIn.focus(); } });
  dateIn.addEventListener("input", () => { showMeta(); touch(); });
  authorIn.addEventListener("input", () => { showMeta(); touch(); });
  authorIn.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); taglineIn.focus(); } });
  textIn.addEventListener("input", () => { grow(); touch(); });
  tagBtn.addEventListener("input", () => { sizeTag(); touch(); });
  tagBtn.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); taglineIn.focus(); } });
  saveBtn.addEventListener("click", () => { clearTimeout(saveT); commit(); close(); });
  q(".je-close").addEventListener("click", close);
  root.addEventListener("mousedown", e => { if (e.target === root) close(); });
  window.addEventListener("keydown", e => { if (e.key === "Escape" && isOpen) { e.stopPropagation(); close(); } }, true);

  delBtn.addEventListener("click", () => {
    if (!delBtn.classList.contains("sure")) {
      delBtn.classList.add("sure"); delBtn.textContent = "Sure? Click again";
      clearTimeout(delT); delT = setTimeout(() => { delBtn.classList.remove("sure"); delBtn.textContent = "Delete"; }, 3000);
      return;
    }
    const en = cur;
    en.media.forEach(m => delBlob(m.id));
    entries = entries.filter(x => x !== en);
    removeEntry(en);
    clearTimeout(saveT); cur = null;
    close();
  });


  /* ---------- the Entries page: the orange sheet's strips ---------- */

  const oHost = document.querySelector("#oBlocks");
  const stageEl = document.querySelector("#stage");
  if (oHost) [...oHost.children].forEach(el => { el.dataset.pat = el.className; });   // remember the decorative pattern

  const stripBtn = (el, act, id) => {
    el.setAttribute("role", "button"); el.tabIndex = 0; el.dataset.act = act;
    if (id) el.dataset.id = id; else delete el.dataset.id;
  };

  function renderStrips() {
    if (!oHost) return;
    const list = sorted();
    while (oHost.children.length < list.length + 6) { const el = document.createElement("i"); el.dataset.pat = ""; oHost.append(el); }
    [...oHost.children].forEach((el, i) => {
      el.textContent = "";
      el.className = el.dataset.pat || "";
      el.removeAttribute("role"); el.removeAttribute("tabindex"); delete el.dataset.act; delete el.dataset.id;
      const k = owner ? i - 1 : i;                     // visitors have no "+ New entry" strip
      if (owner && i === 0) {                          // first strip: add a new entry (owner only)
        el.className = "o-new";
        stripBtn(el, "new");
        const b = document.createElement("b"); b.textContent = "+ New entry";
        el.append(b);
      } else if (list[k]) {                            // then one strip per entry
        const en = list[k];
        el.className = "o-entry";
        stripBtn(el, owner ? "edit" : "view", en.id);
        const b = document.createElement("b"), s = document.createElement("small");
        b.textContent = en.title || "Untitled";
        const extra = mediaText(en);
        s.textContent = labelOf(en) + " · " + fmt(en.date, true) + (extra ? " · " + extra : "");
        el.append(b, s);
        el.title = owner ? "Click to edit or delete" : "Click to read";
      }
    });
  }
  onChange = renderStrips;

  function newEntry() {
    if (!owner) return;
    const en = { id: uid("e"), title: "", date: todayISO(), label: "", author: "", text: "", tagline: "", serial: newSerial(), media: [], created: Date.now() };
    entries.push(en);
    persist(en);
    page = 0;
    render();
    open(en.id, true, "edit");
  }

  const useStrip = e => {
    if (document.body.classList.contains("drawing") || stageEl.dataset.page !== "credits") return;
    const el = e.target.closest && e.target.closest("#oBlocks > i[data-act]");
    if (!el) return;
    if (e.type === "keydown") { if (e.key !== "Enter" && e.key !== " ") return; e.preventDefault(); }
    if (el.dataset.act === "new") newEntry(); else open(el.dataset.id, false, owner && el.dataset.act === "edit" ? "edit" : "view");
  };
  if (oHost) { oHost.addEventListener("click", useStrip); oHost.addEventListener("keydown", useStrip); }


  render();
  (async () => {
    try {
      if (window.__authGate) await window.__authGate;     // login box is open: wait until you are in
      await initAuth();
      await loadCloud();
      if (owner) await migrateLocal();
      render();                                         // strips now know whether you are the owner
      if (sb && !owner && !window.__authGate && new URLSearchParams(location.search).has("owner")) showLogin();   // only when the box was not already shown first
    } catch (e) { console.warn(e); }
  })();
})();
