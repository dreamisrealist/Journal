/* =========================
   STRIP ICONS: hover + click
   Own file on purpose: it runs even if something in script.js stops early.
   Never touches the scrolling track, so the strip keeps moving.
========================= */

(() => {
  const NAMES = {
    cloud: "Cloud", moon: "Moon", mountains: "Mountains",
    sprout: "Sprout", waves: "Waves", music: "Music", camera: "Camera", space: "Space", you: "You"
  };

  const keyOf = cell => {
    const img = cell.querySelector("img");
    const m = img && (img.getAttribute("src") || "").match(/([\w-]+)\.svg/);
    return m && NAMES[m[1]] ? m[1] : null;
  };

  document.querySelectorAll(".band-track").forEach(track => {
    track.querySelectorAll(":scope > span").forEach(cell => {
      const key = keyOf(cell);
      if (!key || cell.querySelector(".lbl")) return;
      cell.classList.add("m-" + key);
      cell.setAttribute("role", "button");
      if (cell.getAttribute("aria-hidden") !== "true") {      // the originals; the rest are loop copies
        cell.tabIndex = 0;
        cell.setAttribute("aria-label", NAMES[key]);
      }
      const lbl = document.createElement("b");
      lbl.className = "lbl";
      lbl.setAttribute("aria-hidden", "true");
      lbl.textContent = NAMES[key];
      cell.append(lbl);
    });

    const play = cell => {
      cell.classList.remove("rip", "go");
      void cell.offsetWidth;                  // restart the animations if clicked again quickly
      cell.classList.add("rip", "go");
    };
    const cellOf = e => { const c = e.target.closest && e.target.closest(".band-track > span"); return c && track.contains(c) ? c : null; };

    track.addEventListener("click", e => { const c = cellOf(e); if (c) play(c); });
    track.addEventListener("keydown", e => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const c = cellOf(e); if (c) { e.preventDefault(); play(c); }
    });
    track.addEventListener("animationend", e => {
      const c = cellOf(e); if (!c) return;
      if (e.animationName === "stripRipple") c.classList.remove("rip");
      else c.classList.remove("go");
    });
  });
})();
