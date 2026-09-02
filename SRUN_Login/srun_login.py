#!/usr/bin/env python3
"""SRUN 校园网自动登录脚本

参考 xju_net-main（模块化）与 xju_srun-main（单文件）整理。

用法：
  python srun_login.py --username 学号 --password 密码
  python srun_login.py --host-ip 10.111.56.19 --username 学号 --password 密码

仅作学习用途，请勿滥用。
"""
import argparse
import sys

sys.path.insert(0, __import__("os").path.dirname(__file__))

from srun import srun_client


def main():
    parser = argparse.ArgumentParser(description="SRUN campus network login")
    parser.add_argument("--host-ip", dest="host_ip", type=str, default="",
                        help="校园网分配的 IP（留空自动获取）")
    parser.add_argument("--username", type=str, required=True, help="校园网账号（学号）")
    parser.add_argument("--password", type=str, required=True, help="校园网密码")
    parser.add_argument("--ac-id", dest="ac_id", type=str, default="4",
                        help="接入点 ID（默认 4）")
    parser.add_argument("--logout", action="store_true", help="执行注销而非登录")
    args = parser.parse_args()

    client = srun_client(ac_id=args.ac_id)
    if args.logout:
        client.logout()
    else:
        client.login(args.username, args.password, args.host_ip)


if __name__ == "__main__":
    main()
