#!/usr/bin/env bash
set -euo pipefail

# 在 Yunzai 根目录执行：
#   bash install.sh
# 或：
#   bash <(curl -fsSL https://raw.githubusercontent.com/eryangn/Genshin-Impact-dps-plugin/main/install.sh)

REPO="https://github.com/eryangn/Genshin-Impact-dps-plugin.git"
DEST="plugins/Genshin-Impact-dps-plugin"

if [ ! -d "plugins" ] || [ ! -f "package.json" ]; then
  echo "请在 Yunzai 根目录运行（当前目录下应有 plugins/ 和 package.json）"
  exit 1
fi

if [ -d "$DEST" ]; then
  echo "插件已存在：$DEST"
  echo "更新请执行：git -C $DEST pull"
  exit 0
fi

git clone --depth=1 "$REPO" "$DEST"
echo
echo "安装完成：$DEST"
echo "重启 Yunzai 后发送 #dps帮助 验证"
