# luci-app-srun-login
一个基于 LuCI 的深澜校园网认证插件适用于Openwrt，通过网页界面即可完成登录、注销、账号管理与日志查看，无需手动执行 Python 脚本

# luci-app-srun-login

> 深澜（SRUN）校园网认证 LuCI 图形化应用

一个基于 LuCI 的深澜校园网认证插件，通过网页界面即可完成登录、注销、账号管理与日志查看，无需手动执行 Python 脚本。
    
    (QAQ)本项目基于新疆大学校园网，对于适配其他校园网，请修改登陆脚本以及运营商选择逻辑
        本项目使用的Openwrt版本为25.12.5，内核版本6.12.94

---

## 功能特性

- **一键登录 / 注销** —— 网页端认证深澜校园网，支持运营商选择
- **运营商选择** —— 自动拼接 `@cmcc` / `@ctcc` / `@cucc` 后缀
- **账号管理** —— 可保存账号为标签按钮，点击快速填充
- **日志查看** —— 底部实时日志区，历史日志持久化保存
- **Proton2025 适配** —— 适配新版 LuCI 界面

---

## 目录结构

```
luci-app-srun-login/
├── Makefile
├── install.sh / uninstall.sh
├── luasrc/controller/srun_login.lua            # LuCI 控制器
├── htdocs/luci-static/resources/view/
│   └── srun_login.js                            # 前端界面
└── root/usr/bin/SRUN_Login/
    ├── srun_login.py                            # 登录脚本入口
    ├── srun.py                                  # 核心逻辑（srun_bx1 协议）
    └── encryption/                              # 加密算法模块
        ├── srun_base64.py
        ├── srun_md5.py
        ├── srun_sha1.py
        └── srun_xencode.py
```

---

## 安装 / 卸载

### 前置依赖

登录脚本为手动拷贝安装，`install.sh` **不调用包管理器**，需先自行安装依赖：

```sh
# OpenWrt 25+（apk 包管理）
apk add python3 py3-requests
```

> 若包名找不到，可尝试 `apk search requests` 或 `pip3 install requests`。

老版本 OpenWrt（opkg）：

```sh
opkg update
opkg install python3 python3-requests
```

### 执行脚本

```sh
sh install.sh      # 安装
sh uninstall.sh    # 卸载
```

### 安装后清理

安装后需**清除缓存并强制刷新浏览器**，否则可能加载旧版前端：

```sh
rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache*
/etc/init.d/uhttpd restart
```

> 浏览器需按 `Ctrl + Shift + R` 强制刷新，普通刷新可能命中旧 JS 缓存。

若之前装过旧版本（使用 `main.username` / `main.save` 旧结构），建议清理历史残留：

```sh
uci -q delete srun_login.username 2>/dev/null
uci -q delete srun_login.password 2>/dev/null
uci -q delete srun_login.save 2>/dev/null
uci -q delete srun_login.main 2>/dev/null
uci commit srun_login
```

安装完成后进入 **「服务 → SRUN 校园网」** 即可使用。

---

## 使用说明

### 运营商

账户名后的 `@xxxx` 代表宽带运营商，界面「运营商」下拉选择会自动拼接：

- **中国移动** —— `@cmcc`
- **中国电信** —— `@ctcc`
- **中国联通** —— `@cucc`

### 账号与日志

- **已保存账号**
  写入 UCI 配置 `srun_login@account[i]`（使用 `uci add` 匿名 section，兼容 OpenWrt 25 新版 uci）。保存后在「已保存账号」列表生成标签，点击可快速填充。
- **保存询问**
  登录时先检测「账号 + 运营商」是否已保存——已保存则直接登录、不再询问；仅新组合才弹窗询问。
- **删除无残留**
  删除按「账号 + 运营商」精确匹配，并自动刷新列表，避免索引重排造成残留。
- **运行日志**
  日志持久化到 `/var/log/srun_login.log`（跨刷新、跨重启保留），「清空日志」会连带清除。

---

## 参考与致谢

本项目参考以下开源项目，特此感谢：

- [LittleNate-Dev/xju_srun](https://github.com/LittleNate-Dev/xju_srun)
- [LittleNate-Dev/xju_net](https://github.com/LittleNate-Dev/xju_net)

> 本项目仅供学习用途，请勿滥用。
