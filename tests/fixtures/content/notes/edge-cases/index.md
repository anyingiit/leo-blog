---
title: "【测试】边界情况"
slug: edge-cases
date: 2026-10-26T20:05:00Z
tags: [测试]
---

没有宽高的图片（gif、svg）要在加载后重新判断折叠。

![动图](./anim.gif)

下面是一张很高的 SVG：

![很高的 SVG](./tall.svg)

图注带引号：

![带"引号"的图注](./quote.jpg "标题里有\"引号\"")

包在链接里的图不进图集：

[![包在链接里的图](./linked.jpg)](https://example.com/)

![找不到的图片](./missing.png)
