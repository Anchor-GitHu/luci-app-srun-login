#!/bin/sh
# 安装 luci-app-srun-login
BASE_DIR=$(cd "$(dirname "$0")" && pwd)
echo "== 安装 SRUN 校园网认证（目录：$BASE_DIR） =="

mkdir -p /usr/bin/SRUN_Login /usr/lib/lua/luci/controller /www/luci-static/resources/view /etc/init.d

# 复制后端登录脚本
cp -r "$BASE_DIR/root/usr/bin/SRUN_Login/." /usr/bin/SRUN_Login/ 2>&1 && echo "  [OK] 后端脚本" || echo "  [FAIL] 后端脚本"
chmod 0755 /usr/bin/SRUN_Login/*.py 2>/dev/null

# 复制开机自动登录启动脚本
cp "$BASE_DIR/root/etc/init.d/srun_login" /etc/init.d/srun_login 2>&1 && echo "  [OK] 开机自启脚本" || echo "  [FAIL] 开机自启脚本"
chmod 0755 /etc/init.d/srun_login 2>/dev/null
/etc/init.d/srun_login enable 2>/dev/null

# 复制控制器（LuCI 标准目录）
cp "$BASE_DIR/luasrc/controller/srun_login.lua" /usr/lib/lua/luci/controller/srun_login.lua 2>&1 && echo "  [OK] 控制器" || echo "  [FAIL] 控制器"

# 复制前端
cp "$BASE_DIR/htdocs/luci-static/resources/view/srun_login.js" /www/luci-static/resources/view/srun_login.js 2>&1 && echo "  [OK] 前端" || echo "  [FAIL] 前端"

# 清除 LuCI 缓存
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache /tmp/luci-indexcache.* /tmp/luci-modulecache.* 2>/dev/null

# 重启 Web 服务
/etc/init.d/uhttpd restart 2>/dev/null || /etc/init.d/lighttpd restart 2>/dev/null || true

echo "== 安装完成，请刷新 LuCI 页面，进入「服务 → SRUN 校园网」 =="
