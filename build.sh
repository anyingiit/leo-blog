#!/usr/bin/env bash
# Cloudflare Pages 构建命令：bash build.sh（CI 也调用它，两边行为一致）
# 1. Hugo 版本只在这里锁定：当前 PATH 里的 hugo 版本不对就下载官方二进制并校验 sha256，
#    CF 后台的 HUGO_VERSION 环境变量因此不再起作用。升级时只改 HUGO_VERSION 和对应的 sha256。
# 2. 生产（main）用 hugo.yaml 里的 baseURL；预览构建改用 CF 注入的预览地址，
#    否则预览站里的绝对链接（文章、标签、RSS、canonical、语言切换）都会跳回主站。
set -euo pipefail

HUGO_VERSION="0.151.0"
# 下面各平台的 sha256 取自 https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_${HUGO_VERSION}_checksums.txt

hugo_matches() {
  command -v hugo >/dev/null 2>&1 &&
    hugo version | grep -q "v${HUGO_VERSION}-.*+extended"
}

if ! hugo_matches; then
  case "$(uname -s)-$(uname -m)" in
    Linux-x86_64) platform=linux-amd64
      sha256=f2fe3b4ef90bf053d93c713eca1d4d5a467d8d2d5da858a448d55eb71ad44ddf ;;
    Linux-aarch64 | Linux-arm64) platform=linux-arm64
      sha256=b460413b756e477ed2c4273941bee6174576449c1125bc125a276b67c3529270 ;;
    Darwin-*) platform=darwin-universal
      sha256=ed58a5c91524273cf9bfcb92f1438887c2fc9888535c6ebca678882319639e93 ;;
    *) echo "build.sh: 不支持的平台 $(uname -s)-$(uname -m)，请手动安装 Hugo Extended ${HUGO_VERSION}" >&2; exit 1 ;;
  esac
  bin_dir="${XDG_CACHE_HOME:-$HOME/.cache}/leo-blog/hugo-${HUGO_VERSION}"
  if [ ! -x "$bin_dir/hugo" ]; then
    echo "build.sh: 下载 Hugo Extended ${HUGO_VERSION} (${platform})" >&2
    mkdir -p "$bin_dir"
    tarball="$bin_dir/hugo.tar.gz"
    curl -fsSL -o "$tarball" \
      "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_${platform}.tar.gz"
    if command -v sha256sum >/dev/null 2>&1; then
      actual="$(sha256sum "$tarball" | cut -d' ' -f1)"
    else
      actual="$(shasum -a 256 "$tarball" | cut -d' ' -f1)"
    fi
    if [ "$actual" != "$sha256" ]; then
      echo "build.sh: Hugo 压缩包 sha256 不匹配（期望 $sha256，实际 ${actual}）" >&2
      rm -f "$tarball"
      exit 1
    fi
    tar -xzf "$tarball" -C "$bin_dir" hugo
    rm -f "$tarball"
  fi
  export PATH="$bin_dir:$PATH"
fi
hugo version

if [ -n "${CF_PAGES_URL:-}" ] && [ "${CF_PAGES_BRANCH:-}" != "main" ]; then
  exec hugo --gc --minify -b "${CF_PAGES_URL%/}/" "$@"
fi
exec hugo --gc --minify "$@"
