#!/bin/sh
# 卸载 luci-app-srun-login
echo "== 卸载 SRUN 校园网认证 =="

rm -rf /usr/bin/SRUN_Login
rm -f /usr/lib/lua/luci/controller/srun_login.lua
rm -f /usr/share/lua/luci/controller/srun_login.lua
rm -f /www/luci-static/resources/view/srun_login.js

rm -f /tmp/luci-indexcache /tmp/luci-modulecache 2>/dev/null || true

if command -v apk >/dev/null 2>&1; then
  apk del luci-app-srun-login 2>/dev/null || true
fi

echo "== 卸载完成 =="
