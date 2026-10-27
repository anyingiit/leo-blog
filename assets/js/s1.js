// S-1 译本：
// - 原版页面按容器宽度缩放（首屏的缩放由 original.html 里的内联脚本先设好）；加宽方案允许放大到 1.4 倍
// - 方案 C 的重排/原版切换（宽屏、窄屏分别记住选择；没选过时宽屏默认原版、窄屏默认重排；切换时停在同一原文页）
// - 沉浸阅读：网址带 ?read=1 时隐藏站点外壳，只留正文和细顶栏（目录、页码、翻章、版式、缩放、退出）。
//   宽屏进入时切到原版；窄屏（手机）原版字太小，保持当前版式，可在顶栏切换。退出时回到进入前的版式。
//   缩放记在本机；Esc 退出；[ ] 翻章；g 或点页码跳页；浏览器后退退出沉浸
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
  // 阅读位置 = 原文页码 + 在这一页里读到的比例，切换版式、缩放、进出沉浸时保持
  const TOP = () => (immersive() ? 56 : 80);
  const firstPage = +(chapter?.dataset.firstPage || 0) || null;
  const pageBlocks = () => {
    // [{page, el}]，按顺序；重排版第一页从正文开头算
    if (original && !original.hidden) return [...original.querySelectorAll(".s1-sheet")].map((el) => ({ page: +el.dataset.page, el }));
    if (!reflow) return [];
    return [{ page: firstPage, el: reflow }, ...[...reflow.querySelectorAll(".s1-pg")].map((el) => ({ page: +el.dataset.page + 1, el }))];
  };
  const blockTop = (b) => b.el.getBoundingClientRect().top;
  const blockEnd = (bs, i) => (i + 1 < bs.length ? blockTop(bs[i + 1]) : bs[i].el.closest(".s1-original, .s1-reflow").getBoundingClientRect().bottom);
  const currentPos = () => {
    const bs = pageBlocks();
    let i = -1;
    for (let k = 0; k < bs.length; k++) { if (blockTop(bs[k]) > TOP()) break; i = k; }
    if (i < 0) return bs.length ? { page: bs[0].page, frac: 0 } : null;
    const t = blockTop(bs[i]), h = Math.max(1, blockEnd(bs, i) - t);
    return { page: bs[i].page, frac: Math.min(1, (TOP() - t) / h) };
  };
  const currentPage = () => currentPos()?.page ?? null;
  const goPos = (pos) => {
    if (!pos?.page) return;
    const bs = pageBlocks();
    const i = bs.findIndex((b) => b.page === pos.page);
    if (i < 0) return;
    const t = blockTop(bs[i]), h = blockEnd(bs, i) - t;
    scrollTo({ top: scrollY + t + (pos.frac || 0) * h - TOP() + 1, behavior: "instant" });
  };
  const show = (view, keep) => {
    const pos = keep ? currentPos() : null;
    if (view === "original") ensureOriginal();
    if (reflow) reflow.hidden = view !== "reflow";
    if (original) original.hidden = view !== "original";
    for (const b of sw?.querySelectorAll("button") || []) b.setAttribute("aria-pressed", b.dataset.view === view);
    fit();
    goPos(pos);
  };

  // ---------- 沉浸阅读 ----------
  const view = () => (original && !original.hidden ? "original" : "reflow");
  const narrow = () => !matchMedia("(min-width: 900px)").matches; // 没选过版式时，窄屏默认重排
  const phone = () => !matchMedia("(min-width: 600px)").matches; // 手机上原版字太小，沉浸时也保持重排
  let before = null; // 进入沉浸前的版式
  const readURL = (on) => {
    const u = new URL(location.href);
    if (on) u.searchParams.set("read", "1"); else u.searchParams.delete("read");
    return u;
  };
  const pageEl = ibar?.querySelector(".s1-ibar-page");
  const toggleBtn = ibar?.querySelector("[data-toggle-view]");
  const fitBtn = ibar?.querySelector('[data-zoom="fit"]');
  if ("scrollRestoration" in history) history.scrollRestoration = "manual"; // 阅读位置由这里管理
  const updateBar = () => {
    if (!immersive()) return;
    if (pageEl) { const p = currentPage(); pageEl.textContent = p ? `${p} / ${pageEl.dataset.total}` : ""; }
    if (toggleBtn) toggleBtn.textContent = view() === "original" ? "重排版" : "原版";
    if (fitBtn) {
      const box = original?.querySelector(".s1-sheets");
      fitBtn.textContent = box?.offsetParent ? Math.round((zoom === "fit" ? fitScale(box) : zoom) * 100) + "%" : "适应";
      fitBtn.title = zoom === "fit" ? "当前：适应宽度" : "恢复适应宽度";
    }
  };
  // push：从页面上的按钮进入时记一条历史，浏览器"后退"就是退出沉浸
  const enter = (push) => {
    const hp = /^#page-(\d+)$/.exec(location.hash);
    const pos = hp ? { page: +hp[1], frac: 0 } : currentPos();
    before = view();
    if (!phone() || !reflow) show("original", false);
    document.body.classList.add("s1-immersive");
    ibar.hidden = false;
    const u = readURL(true);
    if (hp) u.hash = ""; // 跳页用过就去掉，免得以后再进入时又被拉回这一页
    if (push) history.pushState({ s1read: 1 }, "", u); else history.replaceState(history.state, "", u);
    fit();
    if (pos && (hp || pos.page !== firstPage || pos.frac)) goPos(pos); else scrollTo(0, 0);
    updateBar();
    ibar.focus({ preventScroll: true });
  };
  const exit = (fromHistory) => {
    // 从页面按钮进入的（记过一条历史）：退出就是后退一步，真正的退出在 popstate 里做
    if (!fromHistory && history.state?.s1read) return history.back();
    const pos = currentPos();
    document.body.classList.remove("s1-immersive");
    ibar.hidden = true;
    for (const d of ibar.querySelectorAll("details[open]")) d.open = false;
    if (!fromHistory) history.replaceState(null, "", readURL(false));
    if (before && before !== view()) show(before, false);
    fit();
    goPos(pos);
    document.querySelector("[data-enter]")?.focus({ preventScroll: true });
  };
  addEventListener("popstate", () => {
    if (!ibar) return;
    const want = new URLSearchParams(location.search).has("read");
    if (want && !immersive()) enter(false);
    else if (!want && immersive()) exit(true);
  });
  const setZoom = (z) => {
    const pos = currentPos();
    const se = document.scrollingElement;
    const cx = (se.scrollLeft + se.clientWidth / 2) / Math.max(1, se.scrollWidth); // 横向中心位置
    zoom = z;
    try { localStorage.setItem("s1-zoom", String(z)); } catch {}
    fit();
    goPos(pos);
    se.scrollLeft = cx * se.scrollWidth - se.clientWidth / 2;
    updateBar();
  };
  const ZOOMS = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 2];
  const goChapter = (dir) => { const a = ibar.querySelector(`[data-dir="${dir}"]`); if (a) location.href = a.href; };
  // 跳到原文第 n 页：本章内直接滚动，其他章节按目录里的页码范围找
  const jumpTo = (n) => {
    if (!n) return;
    const here = pageBlocks().some((b) => b.page === n);
    if (here) { goPos({ page: n, frac: 0 }); return updateBar(); }
    for (const li of ibar.querySelectorAll(".s1-toc li[data-from]")) {
      const a = li.querySelector("a");
      if (a && n >= +li.dataset.from && n <= +li.dataset.to) { location.href = a.pathname + "?read=1#page-" + n; return; }
    }
    pageEl.animate?.([{ color: "#dc2626" }, { color: "" }], 800); // 没导入的页
  };
  if (ibar) {
    document.querySelector("[data-enter]")?.addEventListener("click", (e) => { e.preventDefault(); enter(true); });
    ibar.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-exit")) return exit(false);
      if (b === pageEl) { const n = prompt(`跳到原文第几页？（1–${pageEl.dataset.total}）`, currentPage() || ""); return jumpTo(parseInt(n, 10)); }
      if (b.hasAttribute("data-toggle-view")) { show(view() === "original" ? "reflow" : "original", true); return updateBar(); }
      if (!b.dataset.zoom) return;
      const box = original.querySelector(".s1-sheets");
      const cur = zoom === "fit" ? fitScale(box) : zoom;
      if (b.dataset.zoom === "fit") return setZoom("fit");
      const next = b.dataset.zoom === "in" ? ZOOMS.find((z) => z > cur + 0.01) : [...ZOOMS].reverse().find((z) => z < cur - 0.01);
      if (next) setZoom(next);
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
    // 键盘：Esc 先关目录再退出；[ ] 翻章（方向键留给滚动，避免误触离开长章节）；g 跳页
    addEventListener("keydown", (e) => {
      if (!immersive() || e.altKey || e.ctrlKey || e.metaKey || e.target.closest("input, textarea, select")) return;
      const t = ibar.querySelector(".s1-ibar-toc[open]");
      if (e.key === "Escape") {
        if (t) { t.open = false; t.querySelector("summary").focus(); } else exit(false);
      } else if (t) {
        return;
      } else if (e.key === "[" || e.key === "]") {
        goChapter(e.key === "[" ? "prev" : "next");
      } else if (e.key === "g" && pageEl) {
        e.preventDefault(); pageEl.click();
      }
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
      try { localStorage.setItem(narrow() ? "s1-view-narrow" : "s1-view", b.dataset.view); } catch {}
      show(b.dataset.view, true);
    });
  }
  if (sw) {
    let saved = null;
    try { saved = localStorage.getItem(narrow() ? "s1-view-narrow" : "s1-view"); } catch {}
    // 原版目录里的跨章链接（#id）只在原版里有目标
    const hash = decodeURIComponent(location.hash.slice(1));
    const wantOriginal = hash && !document.getElementById(hash) && tpl?.content.getElementById(hash);
    const initial = wantOriginal ? "original" : saved || (narrow() ? "reflow" : "original");
    if (initial === "original") {
      show("original", false);
      if (wantOriginal) document.getElementById(hash)?.scrollIntoView();
    }
  }
  if (ibar && new URLSearchParams(location.search).has("read")) enter(false);
})();
