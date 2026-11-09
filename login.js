/* =========================
   OWNER LOGIN  (Dreams' Work Journal)
   Open the site with ?owner at the end of the address to log in as the owner.
   The login is a sheet of the same beige paper as the journal entries. While it is open the
   intro animation is on hold: it only starts after you log in (or choose "Continue as visitor").
   Loads before script.js and journal.js on purpose.
========================= */

(() => {
  const cfg = window.JOURNAL_CLOUD || {};
  if (!window.supabase || !cfg.url || /YOUR-/.test(cfg.url)) return;
  const wantsOwner = new URLSearchParams(location.search).has("owner");

  const sb = window.__sb = window.supabase.createClient(cfg.url, cfg.key);   // journal.js reuses this client

  // is there already a saved session? (Supabase keeps it in localStorage)
  let hasSession = false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (/^sb-.*-auth-token$/.test(k)) { const v = JSON.parse(localStorage.getItem(k)); if (v && v.access_token) hasSession = true; }
    }
  } catch (e) {}

  const css = document.createElement("style");
  css.textContent = `
  .ol { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; background: #0b0b0b;
        font-family: 'Obys NG', 'Inter Tight', 'Helvetica Neue', Arial, sans-serif; letter-spacing: -.02em; }
  .ol-sheet { width: min(92vw, 560px); background: #cbc9bb var(--img-beige, none) top center / 100% auto repeat-y; color: #111;
        box-shadow: 0 -10px 60px rgba(0,0,0,.45); }
  .ol-top { display: flex; align-items: stretch; height: 40px; border-bottom: 1px solid #262626; font-size: 15px; font-weight: 600; }
  .ol-dots { display: flex; align-items: center; gap: 4px; padding: 0 12px; border-right: 1px solid #262626; }
  .ol-dots i { width: 11px; height: 11px; border-radius: 50%; background: #262626; }
  .ol-dots i + i { background: #7b7a70; }
  .ol-lab { display: flex; align-items: center; padding-left: 14px; }
  .ol-year { display: flex; align-items: center; margin-left: auto; padding-right: 18px; color: #6d6a5e; }
  .ol-hero { padding: 10px 20px 18px; border-bottom: 1px solid #262626; }
  .ol-hero h2 { font-size: clamp(46px, 11vw, 92px); font-weight: 800; line-height: .92; letter-spacing: -.055em; color: #262626; }
  .ol-hero p { margin-top: 12px; font-size: 15px; font-weight: 700; color: #6d6a5e; }
  .ol-form { display: grid; gap: 18px; padding: 20px 20px 22px; }
  .ol-field { display: grid; gap: 2px; }
  .ol-field span { font-size: 13px; font-weight: 700; color: #6d6a5e; }
  .ol-field input { width: 100%; padding: 6px 0 8px; background: none; border: 0; border-bottom: 1px solid #262626; outline: 0;
        border-radius: 0; color: #262626; font: inherit; font-size: 22px; font-weight: 700; transition: border-color .2s; }
  .ol-field input:focus { border-bottom-color: #e0562c; }
  .ol-field input::placeholder { color: #9a988b; opacity: 1; }
  .ol-msg { min-height: 1.2em; font-size: 14px; font-weight: 700; color: #e0562c; }
  .ol-foot { display: flex; align-items: center; gap: 14px; padding: 14px 20px; border-top: 1px solid #262626; }
  .ol-go { display: inline-flex; align-items: center; gap: 10px; padding: 9px 22px; background: #262626; color: #e6e4d8; border: 0;
        font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
  .ol-go svg { width: 15px; height: auto; }
  .ol-go:hover, .ol-go:focus-visible { background: #e0562c; color: #fff; outline: 0; }
  .ol-go:disabled { opacity: .6; cursor: wait; }
  .ol-skip { margin-left: auto; padding: 0; background: none; border: 0; color: #262626; font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
  .ol-skip span { position: relative; }
  .ol-skip span::after { content: ""; position: absolute; left: 0; right: 0; bottom: -3px; height: 2px; background: currentColor; transform: scaleX(0); transform-origin: left center; transition: transform .3s ease; }
  .ol-skip:hover span::after, .ol-skip:focus-visible span::after { transform: scaleX(1); }
  .ol-pix { position: absolute; left: 28px; bottom: 28px; }
  .ol-shake { animation: olShake .35s; }
  @keyframes olShake { 20% { transform: translateX(-8px); } 40% { transform: translateX(7px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(3px); } }
  @media (max-width: 480px) { .ol-foot { flex-wrap: wrap; } }
  `;
  document.head.append(css);

  const FRAMES = [
    ".......\n.#...#.\n.......\n.......\n.......\n.#...#.\n.......",
    "#.....#\n.#...#.\n..#.#..\n.......\n..#.#..\n.#...#.\n#.....#",
    ".##.##.\n##...##\n#.....#\n.......\n#.....#\n##...##\n.##.##.",
    "..#.#..\n.#...#.\n#.....#\n.......\n#.....#\n.#...#.\n..#.#.."
  ].map(f => f.split("\n").join(""));

  function show(gate) {
    if (document.querySelector(".ol")) return;
    const root = document.createElement("div");
    root.className = "ol";
    root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Owner login");
    root.innerHTML =
      '<div class="ol-sheet">' +
        '<header class="ol-top"><span class="ol-dots" aria-hidden="true"><i></i><i></i></span><span class="ol-lab">Owner</span><span class="ol-year">&copy;' + new Date().getFullYear() + '</span></header>' +
        '<section class="ol-hero"><h2>Welcome<br>back.</h2><p>Log in to write, edit and delete entries.</p></section>' +
        '<form class="ol-form" novalidate>' +
          '<label class="ol-field"><span>Email</span><input type="email" name="email" autocomplete="username" placeholder="you@example.com" required></label>' +
          '<label class="ol-field"><span>Password</span><input type="password" name="pw" autocomplete="current-password" placeholder="••••••••" required></label>' +
          '<div class="ol-msg" role="alert" aria-live="polite"></div>' +
        '</form>' +
        '<footer class="ol-foot">' +
          '<button type="submit" class="ol-go">Log in <svg viewBox="0 0 16 10" aria-hidden="true"><path d="M0 5h14M10 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></button>' +
          '<button type="button" class="ol-skip"><span>Continue as visitor</span></button>' +
        '</footer>' +
      '</div>' +
      '<div class="ol-pix"><div class="pixel-loader"></div></div>';
    document.body.append(root);

    const q = s => root.querySelector(s);
    const sheet = q(".ol-sheet"), form = q(".ol-form"), msg = q(".ol-msg"), go = q(".ol-go");
    const pix = q(".pixel-loader");
    for (let i = 0; i < 49; i++) pix.append(document.createElement("i"));
    const cells = [...pix.children];
    let step = 0;
    const draw = () => FRAMES[step].split("").forEach((c, i) => cells[i].classList.toggle("on", c === "#"));
    draw();
    const timer = setInterval(() => { step = (step + 1) % FRAMES.length; draw(); }, 380);

    if (window.gsap) gsap.from(sheet, { y: innerHeight * 1.1, rotation: -3.5, transformOrigin: "50% 0%", duration: 0.85, ease: "power3.out" });

    // leave: the sheet drops away, then the intro animation (or the page) continues
    const finish = loggedIn => {
      clearInterval(timer);
      const next = () => {
        root.remove();
        if (gate) { if (window.__release) window.__release(); if (window.__resumeIntro) window.__resumeIntro(); }
        else if (loggedIn) location.replace(location.pathname);
      };
      if (window.gsap) {
        gsap.to(sheet, { y: innerHeight * 1.1, rotation: 3, duration: 0.5, ease: "power3.in" });
        gsap.to(root, { opacity: 0, duration: 0.35, delay: 0.4, onComplete: next });
      } else next();
    };

    const submit = async () => {
      if (!form.email.value.trim() || !form.pw.value) { msg.textContent = "Enter your email and password."; return; }
      go.disabled = true; msg.textContent = "Logging in…";
      const r = await sb.auth.signInWithPassword({ email: form.email.value.trim(), password: form.pw.value });
      if (r.error) {
        go.disabled = false; msg.textContent = r.error.message;
        sheet.classList.remove("ol-shake"); void sheet.offsetWidth; sheet.classList.add("ol-shake");
        form.pw.select();
        return;
      }
      msg.textContent = "";
      finish(true);
    };
    go.addEventListener("click", submit);
    form.addEventListener("submit", e => { e.preventDefault(); submit(); });
    form.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
    q(".ol-skip").addEventListener("click", () => finish(false));
    setTimeout(() => form.email.focus({ preventScroll: true }), 900);
  }

  window.ownerLogin = { show };

  // the intro animation waits for the login; journal.js waits too, so it knows who you are
  if (wantsOwner && !hasSession) {
    window.__holdIntro = true;
    window.__authGate = new Promise(res => { window.__release = res; });
    const start = () => show(true);
    if (document.body) start(); else document.addEventListener("DOMContentLoaded", start, { once: true });
  }
})();
