#!/bin/sh
# 卸载 luci-app-srun-login
echo "== 卸载 SRUN 校园网认证 =="

rm -rf /usr/bin/SRUN_Login
rm -f /usr/lib/lua/luci/controller/srun_login.lua
rm -f /www/luci-static/resources/view/srun_login.js
rm -f /var/log/srun_login.log

rm -rf /tmp/luci-indexcache /tmp/luci-modulecache /tmp/luci-indexcache.* /tmp/luci-modulecache.* 2>/dev/null || true

# 重启 Web 服务使卸载生效
/etc/init.d/uhttpd restart 2>/dev/null || /etc/init.d/lighttpd restart 2>/dev/null || true

echo "== 卸载完成 =="
