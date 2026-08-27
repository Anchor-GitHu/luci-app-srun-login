module("luci.controller.srun_login", package.seeall)

local sys = require "luci.sys"
local json = require "luci.jsonc"
local http = require "luci.http"

local UCI_CONF = "srun_login"
local UCI_SECTION = "main"

-- 确保 UCI 配置存在且有一个合法的 section
local function ensure_config()
	local ok = sys.exec("uci -q get " .. UCI_CONF .. "." .. UCI_SECTION .. " >/dev/null 2>&1 && echo yes")
	if ok:match("yes") then
		return
	end
	-- 创建 section（匿名命名 section）
	sys.exec("uci -q set " .. UCI_CONF .. "." .. UCI_SECTION .. "=srun_login")
end

local function get_device_key()
	-- 用设备 MAC 地址作为加密密钥（取第一个非回环网卡的 MAC）
	local mac = sys.exec("cat /sys/class/net/eth0/address 2>/dev/null | tr -d ':'")
	mac = mac and mac:gsub("%s", "") or ""
	if mac == "" then
		mac = sys.exec("awk 'NR==1{print}' /sys/class/net/eth*/address 2>/dev/null | tr -d ':'")
		mac = mac and mac:gsub("%s", "") or ""
	end
	if mac == "" then
		mac = "srun-default-key-2024"
	end
	return mac
end

-- 单字节按位异或（Lua 5.1 兼容，纯算术实现，不依赖 bit 库）
local function byte_xor(a, b)
	local r = 0
	local bit_val = 1
	for _ = 1, 8 do
		local ba = a % 2
		local bb = b % 2
		if ba ~= bb then
			r = r + bit_val
		end
		a = math.floor(a / 2)
		b = math.floor(b / 2)
		bit_val = bit_val * 2
	end
	return r
end

-- 简单 XOR 加密（密钥与数据循环异或，避免明文存储）
local function xor_crypt(data, key)
	if key == "" then return data end
	local klen = #key
	local out = {}
	for i = 1, #data do
		local b = data:byte(i)
		local kb = key:byte(((i - 1) % klen) + 1)
		out[i] = string.char(byte_xor(b, kb))
	end
	return table.concat(out)
end

local b64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
local function base64_encode(data)
	local out = {}
	local i = 1
	while i <= #data do
		local b1 = data:byte(i)
		local b2 = data:byte(i + 1) or 0
		local b3 = data:byte(i + 2) or 0
		local n = b1 * 65536 + b2 * 256 + b3
		out[#out + 1] = b64chars:sub(math.floor(n / 262144) % 64 + 1, math.floor(n / 262144) % 64 + 1)
		out[#out + 1] = b64chars:sub(math.floor(n / 4096) % 64 + 1, math.floor(n / 4096) % 64 + 1)
		out[#out + 1] = (i + 1 <= #data) and b64chars:sub(math.floor(n / 64) % 64 + 1, math.floor(n / 64) % 64 + 1) or "="
		out[#out + 1] = (i + 2 <= #data) and b64chars:sub(n % 64 + 1, n % 64 + 1) or "="
		i = i + 3
	end
	return table.concat(out)
end

local function base64_decode(data)
	data = data:gsub("[^" .. b64chars .. "=]", "")
	local out = {}
	local i = 1
	while i <= #data do
		local c1 = (b64chars:find(data:sub(i, i), 1, true) or 0) - 1
		local c2 = (b64chars:find(data:sub(i + 1, i + 1), 1, true) or 0) - 1
		local c3 = (b64chars:find(data:sub(i + 2, i + 2), 1, true) or 0) - 1
		local c4 = (b64chars:find(data:sub(i + 3, i + 3), 1, true) or 0) - 1
		local n = c1 * 262144 + c2 * 4096 + c3 * 64 + c4
		out[#out + 1] = string.char(math.floor(n / 65536) % 256)
		if data:sub(i + 2, i + 2) ~= "=" then
			out[#out + 1] = string.char(math.floor(n / 256) % 256)
		end
		if data:sub(i + 3, i + 3) ~= "=" then
			out[#out + 1] = string.char(n % 256)
		end
		i = i + 4
	end
	return table.concat(out)
end

local function encrypt_pwd(plain)
	return base64_encode(xor_crypt(plain, get_device_key()))
end

local function decrypt_pwd(enc)
	if not enc or enc == "" then return "" end
	local ok, raw = pcall(base64_decode, enc)
	if not ok then return "" end
	return xor_crypt(raw, get_device_key())
end

local function get_config_value(name, default)
	local v = (sys.exec("uci -q get " .. UCI_CONF .. "." .. UCI_SECTION .. "." .. name .. " 2>/dev/null") or ""):gsub("\n", "")
	if v == "" then
		return default
	end
	return v
end

local function uci_set(key, value)
	local v = value:gsub("'", "'\\''")
	sys.exec("uci -q set " .. UCI_CONF .. "." .. UCI_SECTION .. "." .. key .. "='" .. v .. "'")
end

local function uci_del(key)
	sys.exec("uci -q delete " .. UCI_CONF .. "." .. UCI_SECTION .. "." .. key .. " 2>/dev/null")
end

function index()
	entry({"admin", "services", "srun_login"}, view("srun_login"), _("SRUN 校园网"), 80).dependent = true
	entry({"admin", "services", "srun_login", "login"}, call("action_login")).leaf = true
	entry({"admin", "services", "srun_login", "logout"}, call("action_logout")).leaf = true
	entry({"admin", "services", "srun_login", "config"}, call("action_config")).leaf = true
end

function action_config()
	local method = http.getenv("REQUEST_METHOD") or "GET"

	if method == "POST" then
		local username = http.formvalue("username") or ""
		local password = http.formvalue("password") or ""
		local save = http.formvalue("save") or "0"

		if save == "1" and username ~= "" then
			ensure_config()
			uci_set("username", username)
			uci_set("password", encrypt_pwd(password))
			uci_set("save", "1")
		else
			uci_del("username")
			uci_del("password")
			uci_del("save")
		end
		sys.exec("uci commit " .. UCI_CONF)

		http.prepare_content("application/json")
		http.write(json.stringify({ok = true}))
		return
	end

	-- GET：返回已保存的配置
	http.prepare_content("application/json")
	http.write(json.stringify({
		username = get_config_value("username", ""),
		password = decrypt_pwd(get_config_value("password", "")),
		save = get_config_value("save", "0")
	}))
end

function action_login()
	local username = http.formvalue("username") or ""
	local password = http.formvalue("password") or ""
	local remember = http.formvalue("remember") or "0"
	if username == "" or password == "" then
		http.status(400, "Bad Request")
		http.prepare_content("application/json")
		http.write(json.stringify({ok = false, msg = "账号、密码不能为空"}))
		return
	end

	-- 若勾选记住，则保存加密配置
	if remember == "1" then
		ensure_config()
		uci_set("username", username)
		uci_set("password", encrypt_pwd(password))
		uci_set("save", "1")
		sys.exec("uci commit " .. UCI_CONF)
	else
		uci_del("username")
		uci_del("password")
		uci_del("save")
		sys.exec("uci commit " .. UCI_CONF .. " 2>/dev/null")
	end

	local cmd = string.format("python3 /usr/bin/SRUN_Login/srun_login.py --username %q --password %q 2>&1", username, password)
	local out = sys.exec(cmd)
	http.prepare_content("application/json")
	http.write(json.stringify({ok = true, out = out}))
end

function action_logout()
	local out = sys.exec("python3 /usr/bin/SRUN_Login/srun_login.py --logout 2>&1")
	http.prepare_content("application/json")
	http.write(json.stringify({ok = true, out = out}))
end
