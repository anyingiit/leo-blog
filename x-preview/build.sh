#!/usr/bin/env bash
# 整站预览（只在这个预览分支上用）：根目录是现状，v1~v4 是四种同步方案，底部切换条在它们之间跳。
# 用法：bash x-preview/build.sh <站点根地址，以 / 结尾>，hugo 需已在 PATH 里（build.sh 负责）
set -euo pipefail
root="$1"
cd "$(dirname "$0")/.."
python3 x-preview/gen.py x-preview/out
export HUGO_PARAMS_XPREVIEW_ROOT="$root"
hugo --gc --minify -b "$root" --config hugo.yaml,x-preview/config/v0.yaml
for n in 1 2 3 4 5 6 7 8; do
  hugo --minify -b "${root}v$n/" -d "public/v$n" --config "hugo.yaml,x-preview/config/v$n.yaml"
done
