/* =========================
   RESPONSIVE HELPERS  (Dreams' Work Journal)
   Loads first, before script.js. Tiny on purpose:
   1) on phones and tablets the browser fires "resize" every time the address bar slides in or out,
      or the keyboard opens. Nothing about the page width changed, but script.js, credit.js and
      overview.js would rebuild the whole stack each time (jank, sheets jumping). Those height-only
      resizes are swallowed here. Rotating the phone or resizing a desktop window still works.
   2) tags <html> with .touch / .phone so CSS can tell what it is running on.
   3) after a rotation, asks the page to measure once more when the browser has settled.
========================= */

(() => {
  const root = document.documentElement;
  const coarse = window.matchMedia("(pointer: coarse)");
  const phone = window.matchMedia("(max-width: 768px) and (min-height: 480px)");

  const tag = () => {
    root.classList.toggle("touch", coarse.matches);
    root.classList.toggle("phone", phone.matches);
  };
  tag();
  (coarse.addEventListener ? coarse.addEventListener.bind(coarse, "change") : coarse.addListener.bind(coarse))(tag);
  (phone.addEventListener ? phone.addEventListener.bind(phone, "change") : phone.addListener.bind(phone))(tag);

  let lastW = window.innerWidth;
  let forced = false;

  // capture phase on window + first script to load = runs before every other resize listener
  window.addEventListener("resize", e => {
    const w = window.innerWidth;
    if (forced) { lastW = w; return; }
    if (coarse.matches && w === lastW) { e.stopImmediatePropagation(); return; }   // address bar / keyboard: ignore
    lastW = w;
  }, true);

  // iOS can report the old size right at "orientationchange"; ask again once it has settled
  const settle = () => {
    clearTimeout(settle.t);
    settle.t = setTimeout(() => {
      forced = true;
      window.dispatchEvent(new Event("resize"));
      forced = false;
    }, 350);
  };
  window.addEventListener("orientationchange", settle);
  if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener("change", settle);
})();
