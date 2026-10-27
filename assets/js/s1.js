// S-1 译本：
// - 原版页面按容器宽度缩放（首屏的缩放由 original.html 里的内联脚本先设好）；加宽方案允许放大到 1.4 倍
// - 方案 C 的重排/原版切换（记住选择；没选过时宽屏默认原版、窄屏默认重排；切换时停在同一原文页）
// - 沉浸阅读：网址带 ?read=1 时只显示原版页面和细顶栏，可缩放（记在本机），Esc 退出，← → 翻章
// - 版本菜单点别处时收起
(() => {
  const chapter = document.querySelector(".s1-chapter");
  const wide = chapter?.hasAttribute("data-wide");
  const ibar = document.querySelector(".s1-ibar");
  let zoom = "fit"; // 沉浸阅读里的缩放："fit" 或具体倍数
  try { const z = localStorage.getItem("s1-zoom"); if (z && z !== "fit") zoom = +z; } catch {}
  const immersive = () => document.body.classList.contains("s1-immersive");

  const fitScale = (box) => Math.min(wide || immersive() ? 1.4 : 1, box.clientWidth / 836);
  const fit = () => {
    for (const box of document.querySelectorAll(".s1-sheets")) {
      if (!box.offsetParent) continue;
      const s = immersive() && zoom !== "fit" ? zoom : fitScale(box);
      box.firstElementChild.style.zoom = s !== 1 ? s.toFixed(4) : "";
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
  fit();

  document.addEventListener("click", (e) => {
    for (const d of document.querySelectorAll(".s1-vmenu[open]")) if (!d.contains(e.target)) d.open = false;
  });

  const reflow = document.querySelector(".s1-reflow");
  const original = document.querySelector(".s1-original");
  const tpl = document.querySelector(".s1-original-tpl");
  const sw = document.querySelector(".s1-switch");
  const ensureOriginal = () => {
    if (tpl && original && !original.firstChild) {
      original.append(tpl.content.cloneNode(true));
      for (const s of original.querySelectorAll("script")) s.remove();
      number(original);
    }
  };
  const currentPage = () => {
    // 视口顶部附近的原文页码
    if (!original) return null;
    let page = null;
    const marks = reflow && !reflow.hidden ? reflow.querySelectorAll(".s1-pg") : original.querySelectorAll(".s1-sheet");
    for (const el of marks) {
      if (el.getBoundingClientRect().top >= 80) break;
      page = el.classList.contains("s1-pg") ? +el.dataset.page + 1 : +el.dataset.page;
    }
    return page;
  };
  const goPage = (view, page) => {
    if (!page) return;
    const target = view === "original"
      ? original.querySelector(`.s1-sheet[data-page="${page}"]`)
      : reflow.querySelector(`.s1-pg[data-page="${page - 1}"]`);
    target?.scrollIntoView();
  };
  const show = (view, keep) => {
    const page = keep ? currentPage() : null;
    if (view === "original") ensureOriginal();
    if (reflow) reflow.hidden = view !== "reflow";
    if (original) original.hidden = view !== "original";
    for (const b of sw?.querySelectorAll("button") || []) b.setAttribute("aria-pressed", b.dataset.view === view);
    fit();
    goPage(view, page);
  };

  // ---------- 沉浸阅读 ----------
  const setRead = (on) => {
    const u = new URL(location.href);
    if (on) u.searchParams.set("read", "1"); else u.searchParams.delete("read");
    history.replaceState(null, "", u);
  };
  const enter = () => {
    const page = currentPage();
    show("original", false);
    document.body.classList.add("s1-immersive");
    ibar.hidden = false;
    setRead(true);
    fit();
    if (page) goPage("original", page); else scrollTo(0, 0);
  };
  const exit = () => {
    const page = currentPage();
    document.body.classList.remove("s1-immersive");
    ibar.hidden = true;
    setRead(false);
    fit();
    goPage("original", page);
  };
  const setZoom = (z) => {
    const page = currentPage();
    zoom = z;
    try { localStorage.setItem("s1-zoom", String(z)); } catch {}
    fit();
    goPage("original", page);
  };
  if (ibar) {
    document.querySelector("[data-enter]")?.addEventListener("click", (e) => { e.preventDefault(); enter(); });
    ibar.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-exit")) return exit();
      const box = original.querySelector(".s1-sheets");
      const cur = zoom === "fit" ? fitScale(box) : zoom;
      if (b.dataset.zoom === "fit") setZoom("fit");
      else setZoom(Math.round(Math.min(2, Math.max(0.4, cur * (b.dataset.zoom === "in" ? 1.2 : 1 / 1.2))) * 100) / 100);
    });
    addEventListener("keydown", (e) => {
      if (!immersive() || e.altKey || e.ctrlKey || e.metaKey || e.target.closest("input, textarea")) return;
      if (e.key === "Escape") exit();
      const a = ibar.querySelector(`[data-key="${e.key}"]`);
      if (a) location.href = a.href;
    });
  }

  // ---------- 方案 C：重排/原版切换 ----------
  if (sw) {
    sw.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      try { localStorage.setItem("s1-view", b.dataset.view); } catch {}
      show(b.dataset.view, true);
    });
  }
  const params = new URLSearchParams(location.search);
  if (ibar && params.has("read")) { enter(); return; }
  if (!sw) return;
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
