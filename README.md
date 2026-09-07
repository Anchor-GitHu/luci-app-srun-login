# luci-app-srun-login

> 深澜（SRUN）校园网认证 LuCI 图形化应用

基于 LuCI 的深澜校园网认证插件，通过网页界面即可完成登录、注销、账号管理与日志查看，无需手动执行 Python 脚本。

> 本项目基于新疆大学校园网，适配其他校园网需修改登录脚本及运营商选择逻辑。
> 本项目使用的 OpenWrt 版本为 **25.12.5**，内核版本 6.12.94，LuCI 26.180（Proton2025）。

---

## 功能特性

- **一键登录 / 注销** —— 网页端认证深澜校园网，支持运营商选择
- **运营商选择** —— 自动拼接 `@cmcc` / `@ctcc` / `@cucc` 后缀
- **账号管理** —— 账号以卡片形式展示在页面右侧，点击填充表单、可删除
- **开机自动登录** —— 勾选卡片右下角「自动登录」复选框即可设为开机自动登录（单选，勾选新账号会自动取消旧账号）
- **日志查看** —— 底部日志区，可清空
- **Proton2025 适配** —— 兼容新版 LuCI 及传统（Bootstrap）主题，页面居中限宽

---

## 目录结构

```
luci-app-srun-login/
├── Makefile
├── install.sh / uninstall.sh
├── luasrc/controller/srun_login.lua            # LuCI 控制器
├── htdocs/luci-static/resources/view/
│   └── srun_login.js                            # 前端界面
└── root/
    ├── usr/bin/SRUN_Login/
    │   ├── srun_login.py                        # 登录脚本入口
    │   ├── srun.py                              # 核心逻辑（srun_bx1 协议）
    │   └── encryption/                          # 加密算法模块
    │       ├── srun_base64.py
    │       ├── srun_md5.py
    │       ├── srun_sha1.py
    │       └── srun_xencode.py
    └── etc/init.d/srun_login                    # 开机自动登录启动脚本
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

`install.sh` 会拷贝后端脚本、控制器、前端、开机自启脚本，并执行 `/etc/init.d/srun_login enable` 启用开机自启。

### 安装后清理

安装后需**清除缓存并强制刷新浏览器**，否则可能加载旧版前端：

```sh
rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache*
/etc/init.d/uhttpd restart
```

> 浏览器需按 `Ctrl + Shift + R` 强制刷新，普通刷新可能命中旧 JS 缓存。

安装完成后进入 **「服务 → SRUN 校园网」** 即可使用。

---

## 使用说明

### 运营商

账户名后的 `@xxxx` 代表宽带运营商，界面「运营商」下拉选择会自动拼接：

- **中国移动** —— `@cmcc`
- **中国电信** —— `@ctcc`
- **中国联通** —— `@cucc`

### 账号管理

- **保存账号**：登录时检测「账号 + 运营商」是否已保存——已保存则直接登录；未保存则弹窗询问是否保存。
- **账号卡片**：保存在页面右侧以卡片展示，显示账号名、账号 `@运营商` 简略信息、状态徽章（自动 / 未启用）、「自动登录」复选框和「删除」按钮。
- **点击卡片**：快速填充左侧登录表单。
- **删除账号**：按「账号 + 运营商」精确匹配并自动刷新列表，无索引残留。

### 开机自动登录

- 勾选某账号卡片右下角的「自动登录」复选框，即将其标记为开机自动登录。
- 勾选新账号会**自动取消**其他账号的勾选（严格单选）。
- 标记写入 UCI 配置 `srun_login.@account[i].autologin='1'`。
- 开机时 `/etc/init.d/srun_login` 读取该标记，解密密码后调用 `srun_login.py` 自动认证。

### 账号与密码存储

- 账号写入 UCI 配置 `srun_login@account[i]`（匿名 section，兼容 OpenWrt 25 新版 uci）。
- 密码使用**设备 MAC 地址为密钥**的 XOR 加密后存储，避免明文。

### 运行日志

- 日志写入 `/var/log/srun_login.log`，「清空日志」按钮可清空。
- 注意：OpenWrt 的 `/var` 为内存文件系统（tmpfs），**日志在重启后会丢失**。

---

## 参考与致谢

本项目参考以下开源项目，特此感谢：

- [LittleNate-Dev/xju_srun](https://github.com/LittleNate-Dev/xju_srun)
- [LittleNate-Dev/xju_net](https://github.com/LittleNate-Dev/xju_net)

> 本项目仅供学习用途，请勿滥用。