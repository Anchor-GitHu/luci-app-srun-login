# luci-app-srun-login

深澜（SRUN）校园网认证 LuCI 图形化应用。

## 目录

```
luci-app-srun-login/
├── Makefile
├── install.sh / uninstall.sh
├── luasrc/controller/srun_login.lua    # 控制器
├── htdocs/luci-static/resources/view/srun_login.js  # 前端
└── root/usr/bin/SRUN_Login/
    ├── srun_login.py                   # 后端登录脚本（命令行入口）
    ├── srun.py                         # 核心登录逻辑（srun_bx1 协议）
    └── encryption/                     # 加密算法（base64/md5/sha1/xencode）
```

## 安装 / 卸载

### 前置依赖

登录脚本是手动拷贝安装，`install.sh` **不调用包管理器**，因此需先自行装好依赖：

```sh
# OpenWrt 25+（apk 包管理）
apk add python3 py3-requests
# 若包名找不到，可尝试：
# apk search requests
# pip3 install requests
```

老版本 OpenWrt（opkg）对应为：

```sh
opkg update
opkg install python3 python3-requests
```

### 执行脚本

```sh
sh install.sh      # 安装
sh uninstall.sh    # 卸载
```

安装后需**清除缓存并强制刷新浏览器**，否则可能仍加载旧版前端：

```sh
rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache*
/etc/init.d/uhttpd restart
```

> 浏览器需按 `Ctrl + Shift + R` 强制刷新（普通刷新可能命中缓存的旧 JS）。

若之前装过旧版本（旧版用 `main.username` / `main.save` 结构），建议清理历史残留配置：

```sh
uci -q delete srun_login.username 2>/dev/null
uci -q delete srun_login.password 2>/dev/null
uci -q delete srun_login.save 2>/dev/null
uci -q delete srun_login.main 2>/dev/null
uci commit srun_login
```

安装后进入「服务 → SRUN 校园网」，输入账号密码、选择运营商后点击登录。

## 说明

- 后端用 `python3` + `requests` 发请求。
- 依赖 `python3` 与 `requests`。
- 账户名后的 `@xxxx` 代表你的宽带运营商（界面「运营商」下拉选择会自动拼接）：
  - 中国移动：cmcc
  - 中国电信：ctcc
  - 中国联通：cucc

### 账号与日志持久化

- **已保存账号**：写入 UCI 配置 `srun_login@account[i]`（使用 `uci add` 匿名 section，兼容 OpenWrt 25 新版 uci）。登录时选择「保存」即会存入并在右上「已保存账号」列表生成标签按钮，点击标签可快速填充。
- **运行日志**：登录 / 注销 / 保存日志会追加到 `/var/log/srun_login.log`（跨刷新、跨重启保留）。界面下方「运行日志」区会加载历史日志，「清空日志」按钮会连带清掉持久日志文件。

 **************************************************
     本项目参考
   https://github.com/LittleNate-Dev/xju_srun
   https://github.com/LittleNate-Dev/xju_net
    在此感谢LittleNate-Dev
 **************************************************