#!/usr/bin/env bash
# Cloudflare Pages 构建命令：bash build.sh
# 生产（main）用 hugo.yaml 里的 baseURL；预览构建改用 CF 注入的预览地址，
# 否则预览站里的绝对链接（文章、标签、RSS、canonical、语言切换）都会跳回主站。
set -euo pipefail

if [ -n "${CF_PAGES_URL:-}" ] && [ "${CF_PAGES_BRANCH:-}" != "main" ]; then
  exec hugo --gc --minify -b "${CF_PAGES_URL%/}/" "$@"
fi
exec hugo --gc --minify "$@"
