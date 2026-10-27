// S-1 译本：
// - 原版页面按容器宽度缩放（首屏的缩放由 original.html 里的内联脚本先设好）；加宽方案允许放大到 1.4 倍
// - 方案 C 的重排/原版切换（记住选择；没选过时宽屏默认原版、窄屏默认重排；切换时停在同一原文页）
// - 沉浸阅读：网址带 ?read=1 时隐藏站点外壳，只留正文和细顶栏（目录、页码、翻章、版式、缩放、退出）。
//   宽屏进入时切到原版；窄屏（手机）原版字太小，保持当前版式，可在顶栏切换。退出时回到进入前的版式。
//   缩放记在本机；Esc 退出；← → 翻章（页面能横向滚动时让给滚动）
// - 版本菜单点别处时收起
(() => {
  const chapter = document.querySelector(".s1-chapter");
  const wide = chapter?.hasAttribute("data-wide");
  const ibar = document.querySelector(".s1-ibar");
  let zoom = "fit"; // 沉浸阅读里的缩放："fit" 或具体倍数
  try { const z = localStorage.getItem("s1-zoom"); if (z && z !== "fit") zoom = +z; } catch {}
  const immersive = () => document.body.classList.contains("s1-immersive");

  const fitScale = (box) => Math.min(wide || immersive() ? 1.4 : 1, (immersive() ? document.documentElement.clientWidth : box.clientWidth) / 836);
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
  const view = () => (original && !original.hidden ? "original" : "reflow");
  const narrow = () => !matchMedia("(min-width: 900px)").matches;
  let before = null; // 进入沉浸前的版式
  const setRead = (on) => {
    const u = new URL(location.href);
    if (on) u.searchParams.set("read", "1"); else u.searchParams.delete("read");
    history.replaceState(null, "", u);
  };
  const pageEl = ibar?.querySelector(".s1-ibar-page");
  const toggleBtn = ibar?.querySelector("[data-toggle-view]");
  const updateBar = () => {
    if (!immersive()) return;
    if (pageEl) { const p = currentPage(); pageEl.textContent = p ? `第 ${p} / ${pageEl.dataset.total} 页` : ""; }
    if (toggleBtn) toggleBtn.textContent = view() === "original" ? "重排版" : "原版";
  };
  const enter = () => {
    const page = currentPage();
    before = view();
    if (!narrow() || !reflow) show("original", false);
    document.body.classList.add("s1-immersive");
    ibar.hidden = false;
    setRead(true);
    fit();
    if (page) goPage(view(), page); else scrollTo(0, 0);
    updateBar();
    ibar.focus();
  };
  const exit = () => {
    const page = currentPage();
    document.body.classList.remove("s1-immersive");
    ibar.hidden = true;
    setRead(false);
    if (before && before !== view()) show(before, false);
    fit();
    goPage(view(), page);
    document.querySelector("[data-enter]")?.focus();
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
      if (b.hasAttribute("data-toggle-view")) { show(view() === "original" ? "reflow" : "original", true); return updateBar(); }
      const box = original.querySelector(".s1-sheets");
      const cur = zoom === "fit" ? fitScale(box) : zoom;
      if (b.dataset.zoom === "fit") setZoom("fit");
      else setZoom(Math.round(Math.min(2, Math.max(0.4, cur * (b.dataset.zoom === "in" ? 1.2 : 1 / 1.2))) * 100) / 100);
    });
    addEventListener("scroll", () => requestAnimationFrame(updateBar), { passive: true });
    // 沉浸阅读里点到本版本其他章节的链接（顶栏目录、原版里的跨章链接）时留在沉浸阅读
    const vroot = chapter.dataset.vroot;
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (!immersive() || !a || e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin || !u.pathname.startsWith(vroot) || u.pathname === location.pathname || u.searchParams.has("read")) return;
      e.preventDefault();
      u.searchParams.set("read", "1");
      location.href = u;
    });
    addEventListener("keydown", (e) => {
      if (!immersive() || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.target.closest("input, textarea, select")) return;
      if (e.key === "Escape") {
        const t = ibar.querySelector(".s1-ibar-toc[open]");
        if (t) { t.open = false; t.querySelector("summary").focus(); } else exit();
        return;
      }
      const se = document.scrollingElement;
      if (se.scrollWidth > se.clientWidth + 1) return; // 放大后左右键用来横向滚动
      const a = ibar.querySelector(`[data-key="${e.key}"]`);
      if (a) location.href = a.href;
    });
    document.addEventListener("click", (e) => {
      const t = ibar.querySelector(".s1-ibar-toc[open]");
      if (t && !t.contains(e.target)) t.open = false;
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
  if (sw) {
    let saved = null;
    try { saved = localStorage.getItem("s1-view"); } catch {}
    // 原版目录里的跨章链接（#id）只在原版里有目标
    const hash = decodeURIComponent(location.hash.slice(1));
    const wantOriginal = hash && !document.getElementById(hash) && tpl?.content.getElementById(hash);
    const initial = wantOriginal ? "original" : saved || (narrow() ? "reflow" : "original");
    if (initial === "original") {
      show("original", false);
      if (wantOriginal) document.getElementById(hash)?.scrollIntoView();
    }
  }
  if (ibar && new URLSearchParams(location.search).has("read")) enter();
})();
