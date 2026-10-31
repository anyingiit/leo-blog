// 注入到每部短片页面（layouts/_partials/film.html 在构建时插入），短片本身不用改。
// 短片在沙箱 iframe 里运行，和博客不同源；博客与短片之间只通过 postMessage 交换这几条消息：
//   博客 → 短片：{type:"film:theme", theme:"light"|"dark"}  设到 <html data-theme>
//   短片 → 博客：{type:"film:ready"}、{type:"film:size", height}、{type:"film:escape"}
//   短片自己可以再发（可选）：{type:"film:progress", cue}（当前第几句，博客据此记住进度）、{type:"film:ended"}（放完了）、
//     {type:"film:playing"}（真的出声开播了）、{type:"film:blocked"}（浏览器不让出声，短片在画面上放了自己的播放按钮）、{type:"film:chapters", starts}（每章开始的秒数）
//   博客 → 短片：{type:"film:embed", embed:"fit"|"page"}  博客把播放器铺满窗口或还原时改 <html data-embed>
//   短片 → 博客（可选）：{type:"film:fullscreen"}（浏览器不能让元素全屏时，如 iPhone，请博客把播放器铺满窗口或还原）
//   博客 → 短片（可选）：{type:"film:play"}（开播）、{type:"film:seek", chapter}（从第几章开始放，0 起，对应文字稿里的三级标题）
// 博客打开短片时可能带 ?autoplay=1（读者已经点过播放）和 ?at=<句号>（接着上次看），短片能支持最好，不支持也能放映。
// 地址带 ?embed=fit（全窗口放映）或 ?embed=page（短片页）时给 <html> 加 data-embed，短片可以据此只显示播放器（可选，不支持也能放映）。
(() => {
  const root = document.documentElement;
  const embed = new URLSearchParams(location.search).get("embed");
  if (embed !== null) root.setAttribute("data-embed", embed || "fit");
  if (parent === window) return;
  const send = (m) => parent.postMessage(m, "*");
  addEventListener("message", (e) => {
    if (e.source !== parent || !e.data) return;
    if (e.data.type === "film:theme" && /^(light|dark)$/.test(e.data.theme)) root.dataset.theme = e.data.theme;
    if (e.data.type === "film:embed" && /^(fit|page)$/.test(e.data.embed)) root.setAttribute("data-embed", e.data.embed);
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape") send({ type: "film:escape" }); });
  let last = 0;
  // 量 <html> 自身的高度：scrollHeight 不会小于 iframe 当前的高度，播放器只能变高不能变矮
  const size = () => { const h = Math.ceil(root.getBoundingClientRect().height); if (h !== last) { last = h; send({ type: "film:size", height: h }); } };
  addEventListener("DOMContentLoaded", () => { size(); new ResizeObserver(size).observe(document.body); });
  addEventListener("load", size);
  send({ type: "film:ready" });
})();
