module("luci.controller.srun_login", package.seeall)

local sys = require "luci.sys"
local json = require "luci.jsonc"
local http = require "luci.http"

function index()
	entry({"admin", "services", "srun_login"}, view("srun_login"), _("SRUN 校园网"), 80).dependent = true
	entry({"admin", "services", "srun_login", "login"}, call("action_login")).leaf = true
	entry({"admin", "services", "srun_login", "logout"}, call("action_logout")).leaf = true
end

function action_login()
	local username = http.formvalue("username") or ""
	local password = http.formvalue("password") or ""
	if username == "" or password == "" then
		http.status(400, "Bad Request")
		http.prepare_content("application/json")
		http.write(json.stringify({ok = false, msg = "账号、密码不能为空"}))
		return
	end
	local cmd = string.format("python3 /usr/bin/SRUN_Login/srun_login.py --username %q --password %q 2>&1", username, password)
	local out = sys.exec(cmd)
	http.prepare_content("application/json")
	http.write(json.stringify({ok = true, out = out}))
end

function action_logout()
	local out = sys.exec("python3 /usr/bin/srun_login.py logout 2>&1")
	http.prepare_content("application/json")
	http.write(json.stringify({ok = true, out = out}))
end
