# SRUN_Login

深澜（SRUN）校园网自动登录脚本，参考 `xju_net-main` 与 `xju_srun-main` 整理。

## 目录结构

```
SRUN_Login/
├── srun_login.py          # 入口（argparse）
├── srun.py                # 核心逻辑（srun_client 类）
├── encryption/
│   ├── srun_base64.py
│   ├── srun_md5.py
│   ├── srun_sha1.py
│   └── srun_xencode.py
└── README.md
```

## 使用

```bash
pip install requests
python srun_login.py --username 学号 --password 密码
python srun_login.py --host-ip 10.111.56.19 --username 学号 --password 密码
python srun_login.py --username 学号 --password 密码 --logout
```

## 说明

- 账号为学号，如需运营商后缀（移动 `@cmcc`、电信 `@ctcc`、联通 `@cucc`）请自行加入。
- 仅作学习用途，请勿滥用。
