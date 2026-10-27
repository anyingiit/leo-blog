// S-1 译本：原版页面按容器宽度缩放；方案 C 的重排/原版切换（记住选择，切换时停在同一原文页）
(() => {
  const fit = () => {
    for (const box of document.querySelectorAll(".s1-sheets")) {
      if (!box.offsetParent) continue;
      const inner = box.firstElementChild;
      const s = Math.min(1, box.clientWidth / 836);
      inner.style.zoom = s < 1 ? s.toFixed(4) : "";
    }
  };
  // 原版每页标上原文页码，供切换时对齐
  for (const box of document.querySelectorAll(".s1-sheets")) {
    let n = +box.dataset.firstPage;
    for (const sheet of box.querySelectorAll(".s1-sheet")) sheet.dataset.page = n++;
  }
  addEventListener("resize", fit);
  fit();

  const sw = document.querySelector(".s1-switch");
  if (!sw) return;
  const views = document.querySelectorAll("[data-view]:not(button)");
  const currentPage = () => {
    // 视口顶部附近的原文页码
    const visible = [...document.querySelectorAll(":is(.s1-reflow .s1-pg, .s1-sheet)")].filter((el) => el.offsetParent);
    let page = null;
    for (const el of visible) {
      const top = el.getBoundingClientRect().top;
      if (el.classList.contains("s1-pg")) { if (top < 80) page = +el.dataset.page + 1; }
      else if (top < 80) page = +el.dataset.page;
    }
    return page;
  };
  const show = (view, keep) => {
    const page = keep ? currentPage() : null;
    for (const v of views) v.hidden = v.dataset.view !== view;
    for (const b of sw.querySelectorAll("button")) b.setAttribute("aria-pressed", b.dataset.view === view);
    try { localStorage.setItem("s1-view", view); } catch {}
    fit();
    if (page) {
      const target = view === "original"
        ? document.querySelector(`.s1-sheet[data-page="${page}"]`)
        : document.querySelector(`.s1-reflow .s1-pg[data-page="${page - 1}"]`);
      target?.scrollIntoView();
    }
  };
  sw.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) show(b.dataset.view, true); });
  let saved = null;
  try { saved = localStorage.getItem("s1-view"); } catch {}
  if (saved === "original") show("original", false);
})();
