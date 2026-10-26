#!/usr/bin/env bash
# Cloudflare Pages 构建命令：bash build.sh（CI 也调用它，两边行为一致）
# 1. Hugo 版本只在这里锁定：当前 PATH 里的 hugo 版本不对就下载官方二进制并校验 sha256，
#    CF 后台的 HUGO_VERSION 环境变量因此不再起作用。升级时只改 HUGO_VERSION 和对应的 sha256。
# 2. 生产（main）用 hugo.yaml 里的 baseURL；预览构建改用 CF 注入的预览地址，
#    否则预览站里的绝对链接（文章、标签、RSS、canonical、语言切换）都会跳回主站。
# 3. 预览构建还会带上 tests/fixtures 里的测试短文（见 tests/hugo.test.yaml），正式构建不带。
set -euo pipefail

HUGO_VERSION="0.151.0"
# 下面各平台的 sha256 取自 https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_${HUGO_VERSION}_checksums.txt

# 官方二进制输出 "hugo v0.151.0-<commit>+extended ..."，Homebrew 等自行编译的没有 -<commit>
hugo_matches() {
  local out
  out="$("$1" version 2>/dev/null)" || return 1
  [[ "$out" =~ ^hugo\ v${HUGO_VERSION//./\\.}(-[0-9a-f]+)?\+extended ]]
}

if ! { command -v hugo >/dev/null 2>&1 && hugo_matches hugo; }; then
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
  # 缓存里的二进制也要核对版本；不对（被替换、解压不完整等）就重新下载
  if ! { [ -x "$bin_dir/hugo" ] && hugo_matches "$bin_dir/hugo"; }; then
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
    # 先解压到临时名再改名，中断时不会留下半截的 hugo
    rm -rf "$bin_dir/extract"
    mkdir "$bin_dir/extract"
    tar -xzf "$tarball" -C "$bin_dir/extract" hugo
    mv -f "$bin_dir/extract/hugo" "$bin_dir/hugo"
    rm -rf "$tarball" "$bin_dir/extract"
    if ! hugo_matches "$bin_dir/hugo"; then
      echo "build.sh: 下载的 Hugo 版本不是 ${HUGO_VERSION} Extended" >&2
      exit 1
    fi
  fi
  export PATH="$bin_dir:$PATH"
fi
hugo version

if [ -n "${CF_PAGES_URL:-}" ] && [ "${CF_PAGES_BRANCH:-}" != "main" ]; then
  # 预览站额外带上 tests/fixtures 里的测试短文，方便在 PR 预览里对照查看；正式站不包含它们
  exec hugo --gc --minify -b "${CF_PAGES_URL%/}/" --config hugo.yaml,tests/hugo.test.yaml "$@"
fi
exec hugo --gc --minify "$@"
