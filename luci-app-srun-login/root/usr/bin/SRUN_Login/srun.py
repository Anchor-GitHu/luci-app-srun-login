#!/usr/bin/env python3
"""SRUN 校园网认证核心逻辑（深澜 srun_bx1 协议）。"""
import json
import re
import time

import requests

from encryption.srun_base64 import get_base64
from encryption.srun_md5 import get_md5
from encryption.srun_sha1 import get_sha1
from encryption.srun_xencode import get_xencode

SERVER = "http://202.201.252.10"
GET_CHALLENGE_API = SERVER + "/cgi-bin/get_challenge"
SRUN_PORTAL_API = SERVER + "/cgi-bin/srun_portal"
GET_IP_API = SERVER + "/cgi-bin/rad_user_info?callback=JQuery"

N = "200"
TYPE = "1"
ENC = "srun_bx1"
SRBX1_PREFIX = "{SRBX1}"
MD5_PREFIX = "{MD5}"
OS = "windows+10"
NAME = "windows"
DOUBLE_STACK = "0"

HEADER = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; WOW64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/63.0.3239.26 Safari/537.36")
}
TIMEOUT = 5


def _log(msg):
    ts = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(time.time()))
    print(f"{ts} {msg}", flush=True)


class srun_client:
    def __init__(self, ac_id="4", server=SERVER):
        self.server = server
        self.ac_id = ac_id

    def fetch_ip(self):
        res = requests.get(GET_IP_API, headers=HEADER, timeout=TIMEOUT)
        data = json.loads(res.text[7:-1])
        ip = data.get("client_ip") or data.get("online_ip")
        if not ip:
            raise RuntimeError("无法获取 IP")
        return ip

    def fetch_token(self, username, ip):
        params = {
            "callback": "jQuery1124_" + str(int(time.time() * 1000)),
            "username": username,
            "ip": ip,
            "_": int(time.time() * 1000),
        }
        res = requests.get(GET_CHALLENGE_API, params=params,
                           headers=HEADER, timeout=TIMEOUT)
        m = re.search(r'"challenge":"(.*?)"', res.text)
        if not m:
            raise RuntimeError("获取 token 失败：" + res.text)
        return m.group(1)

    def _make_info(self, username, password, ip):
        info = {
            "username": username,
            "password": password,
            "ip": ip,
            "acid": self.ac_id,
            "enc_ver": ENC,
        }
        return re.sub(r"[\s']", "", re.sub("'", '"', str(info)))

    def _make_chksum(self, token, username, hmd5, ip, i):
        return (token + username + token + hmd5 + token + self.ac_id
                + token + ip + token + N + token + TYPE + token + i)

    def login(self, username, password, host_ip=""):
        username = username.strip()
        password = password.strip()
        if not username or not password:
            _log("账号或密码为空")
            return

        ip = host_ip.strip() or self.fetch_ip()
        _log(f"使用 IP: {ip}")

        token = self.fetch_token(username, ip)
        _log(f"token: {token}")

        i = SRBX1_PREFIX + get_base64(
            get_xencode(self._make_info(username, password, ip), token))
        hmd5 = get_md5(password, token)
        chksum = get_sha1(self._make_chksum(token, username, hmd5, ip, i))

        params = {
            "callback": "jQuery1124_" + str(int(time.time() * 1000)),
            "action": "login",
            "username": username,
            "password": MD5_PREFIX + hmd5,
            "ac_id": self.ac_id,
            "ip": ip,
            "chksum": chksum,
            "info": i,
            "n": N,
            "type": TYPE,
            "os": OS,
            "name": NAME,
            "double_stack": DOUBLE_STACK,
            "_": int(time.time() * 1000),
        }
        res = requests.get(SRUN_PORTAL_API, params=params,
                           headers=HEADER, timeout=TIMEOUT)
        _log(res.text)

    def logout(self):
        ip = self.fetch_ip()
        params = {
            "callback": "jQuery1124_" + str(int(time.time() * 1000)),
            "action": "logout",
            "ip": ip,
            "ac_id": self.ac_id,
            "_": int(time.time() * 1000),
        }
        res = requests.get(SRUN_PORTAL_API, params=params,
                           headers=HEADER, timeout=TIMEOUT)
        _log(res.text)
