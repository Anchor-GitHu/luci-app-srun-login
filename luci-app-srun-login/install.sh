#!/bin/sh
# 安装 luci-app-srun-login
set -e
echo "== 安装 SRUN 校园网认证 =="

mkdir -p /usr/bin /usr/bin/SRUN_Login /usr/lib/lua/luci/controller /www/luci-static/resources/view

cp -r root/usr/bin/SRUN_Login /usr/bin/
chmod 0755 /usr/bin/SRUN_Login/srun_login.py /usr/bin/SRUN_Login/srun.py
chmod 0755 /usr/bin/SRUN_Login/*.py 2>/dev/null || true

cp luasrc/controller/srun_login.lua /usr/lib/lua/luci/controller/srun_login.lua

cp htdocs/luci-static/resources/view/srun_login.js /www/luci-static/resources/view/srun_login.js

#rm -f /tmp/luci-indexcache /tmp/luci-modulecache 2>/dev/null || true

echo "== 安装完成，请刷新 LuCI 页面，进入「服务 → SRUN 校园网」 =="
