#!/usr/bin/env bash
# 把 tests/theme/package.json 锁定版本的 Mermaid（ESM 压缩版和它按需加载的分块）复制到 static/vendor/mermaid/<版本>/。
# 文件原样复制，不做任何改动；tests/theme/output.spec.mjs 逐字节核对。升级步骤见 docs/testing.md。
set -euo pipefail
cd "$(dirname "$0")/.."

pkg=tests/theme/node_modules/mermaid
[ -d "$pkg" ] || { echo "vendor-mermaid: 先在 tests/theme 下运行 npm ci" >&2; exit 1; }
version="$(node -p "require('./$pkg/package.json').version")"
wanted="$(node -p "require('./tests/theme/package.json').devDependencies.mermaid")"
[ "$version" = "$wanted" ] || { echo "vendor-mermaid: 装的是 $version，package.json 要 $wanted，先运行 npm install" >&2; exit 1; }
dest="static/vendor/mermaid/$version"

rm -rf static/vendor/mermaid
mkdir -p "$dest/chunks"
cp "$pkg/LICENSE" "$pkg/dist/mermaid.esm.min.mjs" "$dest/"
cp -R "$pkg/dist/chunks/mermaid.esm.min" "$dest/chunks/"
find "$dest" -name '*.map' -delete
echo "vendor-mermaid: $dest（$(find "$dest" -type f | wc -l | tr -d ' ') 个文件）。记得同步 layouts/_partials/extend_head.html 里的版本号"
