---
title: "Anthropic S-1 非官方中文译本"
description: "Anthropic, PBC 首次公开发行注册声明（Form S-1）的非官方中文译本，AI 翻译，未经人工核对 · 预览：方案A：原版版式·分章"
type: s1
latest: v1.0
params:
  s1mode: original
cascade:
  - type: s1
    params:
      s1mode: original
    build:
      list: local
  - target:
      path: "/s1-a/v0.9/**"
    params:
      robotsNoIndex: true
menus:
  main:
    name: "译文A"
    weight: 1
---
