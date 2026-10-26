// 主题与样式回归测试（docs/testing.md）。基准图只在 CI 的固定镜像里生成和比对，换机器字体渲染会不同。
import { defineConfig, devices } from "@playwright/test";

// 三种设备 × 两种浏览器内核（Chromium≈Chrome，WebKit≈Safari）。CSS 像素 1:1 截图，体积小、逐像素可比。
// 平板、手机开启触屏但不开 isMobile：isMobile 下页面先按 980px 宽排版、等 <meta viewport> 生效后再缩到设备宽，
// 预加载扫描器在这之间挑选 srcset 图片，挑中哪张取决于时序（实测同一页 12 次里 7 次选 720w、5 次选 480w），基准无法固定
const viewports = {
  desktop: { viewport: { width: 1280, height: 800 } },
  tablet: { viewport: { width: 820, height: 1180 }, hasTouch: true },
  phone: { viewport: { width: 390, height: 844 }, hasTouch: true },
};
// Chromium 的栅格化默认会按层、按分块、多线程进行，圆角和细线的抗锯齿偶尔因此差几个像素；
// 下面这些开关让渲染走确定的路径（同类视觉回归工具的通行做法）
const chromiumArgs = ["--font-render-hinting=none", "--disable-gpu", "--disable-gpu-rasterization", "--disable-partial-raster",
  "--disable-skia-runtime-opts", "--force-color-profile=srgb", "--disable-lcd-text", "--disable-threaded-animation",
  "--disable-threaded-scrolling", "--disable-checker-imaging", "--disable-image-animation-resync", "--num-raster-threads=1"];
const browsers = {
  chromium: { ...devices["Desktop Chrome"], launchOptions: { args: chromiumArgs } },
  webkit: devices["Desktop Safari"],
};

export default defineConfig({
  testDir: ".",
  globalSetup: "./global-setup.mjs",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0, // 像素测试不重试：不稳定本身就是要修的问题
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  snapshotPathTemplate: "{testDir}/__snapshots__/{projectName}/{arg}{ext}",
  expect: { toHaveScreenshot: { maxDiffPixels: 0, threshold: 0, animations: "disabled", caret: "hide", scale: "css" } },
  use: { deviceScaleFactor: 1, locale: "zh-CN", timezoneId: "Asia/Shanghai" },
  projects: [
    { name: "output", testMatch: "output.spec.mjs" },
    ...Object.entries(browsers).flatMap(([b, dev]) => Object.entries(viewports).map(([v, vp]) => ({
      name: `${b}-${v}`,
      // 除 output 外的所有 spec 都在每个浏览器×设备里跑，新加的 spec 不会因为没登记而漏跑
      testMatch: "*.spec.mjs", testIgnore: "output.spec.mjs",
      use: { ...dev, ...vp, deviceScaleFactor: 1, browserName: b },
    }))),
  ],
});
