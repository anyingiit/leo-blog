// S-1 译本：原版页面按容器宽度缩放（首屏的缩放由 original.html 里的内联脚本先设好）；
// 方案 C 的重排/原版切换（记住选择；没选过时宽屏默认原版、窄屏默认重排；切换时停在同一原文页）；
// 版本菜单点别处时收起
(() => {
  const fit = () => {
    for (const box of document.querySelectorAll(".s1-sheets")) {
      if (!box.offsetParent) continue;
      const s = Math.min(1, box.clientWidth / 836);
      box.firstElementChild.style.zoom = s < 1 ? s.toFixed(4) : "";
    }
  };
  const number = (root) => {
    for (const box of root.querySelectorAll(".s1-sheets")) {
      let n = +box.dataset.firstPage;
      for (const sheet of box.querySelectorAll(".s1-sheet")) sheet.dataset.page = n++;
    }
  };
  number(document);
  addEventListener("resize", fit);

  document.addEventListener("click", (e) => {
    for (const d of document.querySelectorAll(".s1-vmenu[open]")) if (!d.contains(e.target)) d.open = false;
  });

  const sw = document.querySelector(".s1-switch");
  if (!sw) return;
  const reflow = document.querySelector(".s1-reflow");
  const original = document.querySelector(".s1-original");
  const tpl = document.querySelector(".s1-original-tpl");
  const ensureOriginal = () => {
    if (tpl && !original.firstChild) {
      original.append(tpl.content.cloneNode(true));
      for (const s of original.querySelectorAll("script")) s.remove();
      number(original);
    }
  };
  const currentPage = () => {
    // 视口顶部附近的原文页码
    let page = null;
    const marks = reflow.hidden ? original.querySelectorAll(".s1-sheet") : reflow.querySelectorAll(".s1-pg");
    for (const el of marks) {
      if (el.getBoundingClientRect().top >= 80) break;
      page = el.classList.contains("s1-pg") ? +el.dataset.page + 1 : +el.dataset.page;
    }
    return page;
  };
  const show = (view, keep) => {
    const page = keep ? currentPage() : null;
    if (view === "original") ensureOriginal();
    reflow.hidden = view !== "reflow";
    original.hidden = view !== "original";
    for (const b of sw.querySelectorAll("button")) b.setAttribute("aria-pressed", b.dataset.view === view);
    fit();
    if (page) {
      const target = view === "original"
        ? original.querySelector(`.s1-sheet[data-page="${page}"]`)
        : reflow.querySelector(`.s1-pg[data-page="${page - 1}"]`);
      target?.scrollIntoView();
    }
  };
  sw.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    try { localStorage.setItem("s1-view", b.dataset.view); } catch {}
    show(b.dataset.view, true);
  });
  let saved = null;
  try { saved = localStorage.getItem("s1-view"); } catch {}
  // 原版目录里的跨章链接（#id）只在原版里有目标
  const hash = decodeURIComponent(location.hash.slice(1));
  const wantOriginal = hash && !document.getElementById(hash) && tpl?.content.getElementById(hash);
  const view = wantOriginal ? "original" : saved || (matchMedia("(min-width: 900px)").matches ? "original" : "reflow");
  if (view === "original") {
    show("original", false);
    if (wantOriginal) document.getElementById(hash)?.scrollIntoView();
  }
})();
