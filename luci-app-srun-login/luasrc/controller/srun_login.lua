local M = {}

local sys = require "luci.sys"
local json = require "luci.jsonc"
local http = require "luci.http"

local UCI_CONF = "srun_login"
local LOG_FILE = "/var/log/srun_login.log"
local LOG_MAX_LINES = 500

-- 确保 UCI 配置文件存在（新版 uci 要求文件先存在，否则 uci add 报 Entry not found）
-- 注意：不再创建 main section（历史遗留），仅确保文件存在即可
local function ensure_config()
	sys.exec("touch /etc/config/" .. UCI_CONF .. " 2>/dev/null")
end

-- 追加一条日志到日志文件
local function append_log(msg)
	if not msg or msg == "" then return end
	msg = msg:gsub("\r", "")
	local ts = os.date("%Y-%m-%d %H:%M:%S")
	local line = "[" .. ts .. "] " .. msg
	sys.exec("echo " .. string.format("%q", line) .. " >> " .. LOG_FILE .. " 2>/dev/null")
end

-- 读取日志文件内容（限制最大行数，返回字符串）
local function read_log()
	local out = sys.exec("tail -n " .. LOG_MAX_LINES .. " " .. LOG_FILE .. " 2>/dev/null") or ""
	return out
end

-- 列出所有账号 section 的索引（形如 @account[i] 的 i，从 0 开始）
-- 新版 uci 的 section 是匿名的，只能用 @account[N] 索引访问
local function list_account_indexes()
	local out = sys.exec("uci -q show " .. UCI_CONF .. " 2>/dev/null") or ""
	local indexes = {}
	local seen = {}
	for line in out:gmatch("[^\n]+") do
		local idx = line:match("^" .. UCI_CONF .. "%.@account%[(%d+)%]")
		if idx then
			idx = tonumber(idx)
			if idx ~= nil and not seen[idx] then
				seen[idx] = true
				indexes[#indexes + 1] = idx
			end
		end
	end
	table.sort(indexes)
	return indexes
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

-- 十六进制编码/解码（可靠，避免手写 base64 丢失末尾字节的问题）
local function hex_encode(data)
	return (data:gsub(".", function(c) return string.format("%02x", c:byte()) end))
end

local function hex_decode(s)
	if not s or s == "" then return "" end
	return (s:gsub("%x%x", function(h) return string.char(tonumber(h, 16)) end))
end

local function encrypt_pwd(plain)
	return hex_encode(xor_crypt(plain, get_device_key()))
end

local function decrypt_pwd(enc)
	if not enc or enc == "" then return "" end
	return xor_crypt(hex_decode(enc), get_device_key())
end

-- 运营商后缀映射（登录脚本通过用户名后缀区分运营商）
local OPERATOR_SUFFIX = {
	["cmcc"] = "cmcc",
	["ctcc"] = "ctcc",
	["cucc"] = "cucc",
}

-- 保存账号（新账号或更新已有账号），返回保存后的账号对象
local function save_account(username, password, operator)
	if username == "" then return nil end
	ensure_config()

	-- 已存在同用户名+运营商的账号则更新，否则新建
	local exist_idx = nil
	for _, idx in ipairs(list_account_indexes()) do
		local uname = (sys.exec("uci -q get " .. UCI_CONF .. ".@account[" .. idx .. "].username 2>/dev/null") or ""):gsub("\n", "")
		local uop = (sys.exec("uci -q get " .. UCI_CONF .. ".@account[" .. idx .. "].operator 2>/dev/null") or ""):gsub("\n", "")
		if uname == username and (uop == (operator or "")) then
			exist_idx = idx
			break
		end
	end

	local uname = username:gsub("'", "'\\''")
	local pwd = encrypt_pwd(password)
	local op = (operator or ""):gsub("'", "'\\''")
	local disp = (op ~= "" and (uname .. "@" .. op)) or uname

	local idx = exist_idx
	if idx == nil then
		-- 用 uci add 创建匿名 section，并取最后（最大）索引定位
		sys.exec("uci add " .. UCI_CONF .. " account 2>/dev/null")
		local idxes = list_account_indexes()
		idx = #idxes > 0 and idxes[#idxes] or 0
	end

	local ref = ".@account[" .. idx .. "]"
	sys.exec("uci -q set " .. UCI_CONF .. ref .. ".username='" .. uname .. "'")
	sys.exec("uci -q set " .. UCI_CONF .. ref .. ".password='" .. pwd .. "'")
	sys.exec("uci -q set " .. UCI_CONF .. ref .. ".operator='" .. op .. "'")
	sys.exec("uci -q set " .. UCI_CONF .. ref .. ".name='" .. disp .. "'")
	sys.exec("uci commit " .. UCI_CONF)

	return { id = tostring(idx), name = disp, username = username, operator = (operator or ""), password = password }
end

function M.index()
	entry({"admin", "services", "srun_login"}, view("srun_login"), _("SRUN 校园网"), 80).dependent = true
	entry({"admin", "services", "srun_login", "login"}, call("action_login")).leaf = true
	entry({"admin", "services", "srun_login", "logout"}, call("action_logout")).leaf = true
	entry({"admin", "services", "srun_login", "config"}, call("action_config")).leaf = true
	entry({"admin", "services", "srun_login", "log"}, call("action_log")).leaf = true
end

function M.action_config()
	local method = http.getenv("REQUEST_METHOD") or "GET"

	if method == "POST" then
		local action = http.formvalue("action") or ""
		local username = http.formvalue("username") or ""
		local password = http.formvalue("password") or ""
		local operator = http.formvalue("operator") or ""

		if action == "delete" and username ~= "" then
			-- 按 username + operator 精确删除，避免索引重排导致删错/残留
			for _, idx in ipairs(list_account_indexes()) do
				local uname = (sys.exec("uci -q get " .. UCI_CONF .. ".@account[" .. idx .. "].username 2>/dev/null") or ""):gsub("\n", "")
				local uop = (sys.exec("uci -q get " .. UCI_CONF .. ".@account[" .. idx .. "].operator 2>/dev/null") or ""):gsub("\n", "")
				if uname == username and uop == operator then
					sys.exec("uci -q delete " .. UCI_CONF .. ".@account[" .. idx .. "] 2>/dev/null")
					break
				end
			end
			sys.exec("uci commit " .. UCI_CONF)
			http.prepare_content("application/json")
			http.write(json.stringify({ok = true}))
			return
		end

		if action == "save" and username ~= "" then
			-- 保存新账号（名称默认为学号，可自定义 name）
			local operator = http.formvalue("operator") or ""
			local acc = save_account(username, password, operator)
			append_log("保存账号: " .. username .. (operator ~= "" and ("@" .. operator) or ""))
			http.prepare_content("application/json")
			http.write(json.stringify({ok = true, account = acc}))
			return
		end

		if action == "autologin" then
			-- 设置开机自动登录：将指定账号（username + operator）标记为 autologin=1，并清除其他账号
			local enabled = http.formvalue("enabled") or ""
			local username = http.formvalue("username") or ""
			local operator = http.formvalue("operator") or ""
			ensure_config()
			if enabled == "1" and username ~= "" then
				-- 先清除所有账号的 autologin 标记，保证唯一性
				for _, idx in ipairs(list_account_indexes()) do
					sys.exec("uci -q delete " .. UCI_CONF .. ".@account[" .. idx .. "].autologin 2>/dev/null")
				end
				-- 再为目标账号置位
				for _, idx in ipairs(list_account_indexes()) do
					local uname = (sys.exec("uci -q get " .. UCI_CONF .. ".@account[" .. idx .. "].username 2>/dev/null") or ""):gsub("\n", "")
					local uop = (sys.exec("uci -q get " .. UCI_CONF .. ".@account[" .. idx .. "].operator 2>/dev/null") or ""):gsub("\n", "")
					if uname == username and uop == operator then
						sys.exec("uci -q set " .. UCI_CONF .. ".@account[" .. idx .. "].autologin='1'")
						break
					end
				end
				append_log("已设置开机自动登录账号: " .. username .. (operator ~= "" and ("@" .. operator) or ""))
			else
				-- 关闭：清除所有账号的 autologin 标记
				for _, idx in ipairs(list_account_indexes()) do
					sys.exec("uci -q delete " .. UCI_CONF .. ".@account[" .. idx .. "].autologin 2>/dev/null")
				end
				append_log("已关闭开机自动登录")
			end
			sys.exec("uci commit " .. UCI_CONF .. " 2>/dev/null")
			http.prepare_content("application/json")
			http.write(json.stringify({ok = true}))
			return
		end

		http.prepare_content("application/json")
		http.write(json.stringify({ok = false, msg = "参数错误"}))
		return
	end

	-- GET：返回所有已保存的账号
	local accounts = {}
	for _, idx in ipairs(list_account_indexes()) do
		local uname = (sys.exec("uci -q get " .. UCI_CONF .. ".@account[" .. idx .. "].username 2>/dev/null") or ""):gsub("\n", "")
		local pwd = (sys.exec("uci -q get " .. UCI_CONF .. ".@account[" .. idx .. "].password 2>/dev/null") or ""):gsub("\n", "")
		local nm = (sys.exec("uci -q get " .. UCI_CONF .. ".@account[" .. idx .. "].name 2>/dev/null") or ""):gsub("\n", "")
		local op = (sys.exec("uci -q get " .. UCI_CONF .. ".@account[" .. idx .. "].operator 2>/dev/null") or ""):gsub("\n", "")
		local auto = (sys.exec("uci -q get " .. UCI_CONF .. ".@account[" .. idx .. "].autologin 2>/dev/null") or ""):gsub("\n", "")
		if uname ~= "" then
			accounts[#accounts + 1] = {
				id = tostring(idx),
				name = nm,
				username = uname,
				operator = op,
				password = decrypt_pwd(pwd),
				autologin = (auto == "1")
			}
		end
	end

	http.prepare_content("application/json")
	http.write(json.stringify({accounts = accounts}))
end

function M.action_login()
	local username = http.formvalue("username") or ""
	local password = http.formvalue("password") or ""
	local operator = http.formvalue("operator") or ""
	if username == "" or password == "" then
		http.status(400, "Bad Request")
		http.prepare_content("application/json")
		http.write(json.stringify({ok = false, msg = "账号、密码不能为空"}))
		return
	end

	-- 拼接运营商后缀（登录脚本约定：@cmcc / @ctcc / @cucc）
	local login_name = username
	local suffix = OPERATOR_SUFFIX[operator]
	if suffix then
		login_name = username .. "@" .. suffix
	end

	local cmd = string.format("python3 /usr/bin/SRUN_Login/srun_login.py --username %q --password %q 2>&1", login_name, password)
	local out = sys.exec(cmd)
	append_log("登录 " .. login_name .. ":\n" .. out)
	http.prepare_content("application/json")
	http.write(json.stringify({ok = true, out = out}))
end

function M.action_logout()
	local out = sys.exec("python3 /usr/bin/SRUN_Login/srun_login.py --logout 2>&1")
	append_log("注销:\n" .. out)
	http.prepare_content("application/json")
	http.write(json.stringify({ok = true, out = out}))
end

function M.action_log()
	local method = http.getenv("REQUEST_METHOD") or "GET"
	if method == "POST" then
		-- 清空日志
		sys.exec("rm -f " .. LOG_FILE .. " 2>/dev/null")
		http.prepare_content("application/json")
		http.write(json.stringify({ok = true}))
		return
	end
	-- GET：返回历史日志
	http.prepare_content("application/json")
	http.write(json.stringify({log = read_log()}))
end

return M
