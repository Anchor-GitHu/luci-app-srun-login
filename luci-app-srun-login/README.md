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

```sh
sh install.sh      # 安装
sh uninstall.sh    # 卸载
```

安装后刷新 LuCI，进入「服务 → SRUN 校园网」，输入账号密码点击登录。

## 说明

- 后端用 `python3` + `requests` 发请求。
- 依赖 `python3` 与 `python3-requests`。
-使用时将脚本中的用户名和密码修改成自己的即可，账户名后的“@xxxx”代表你的宽带运行商。
-中国移动：cmcc
-中国电信：ctcc
-中国联通：cucc

 **************************************************
     本项目参考
   https://github.com/LittleNate-Dev/xju_srun
   https://github.com/LittleNate-Dev/xju_net
    在此感谢LittleNate-Dev
 **************************************************