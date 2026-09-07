'use strict';
'require view';
'require ui';

function postForm(action, data) {
	var url = L.url('admin/services/srun_login', action);
	return new Promise(function(resolve, reject) {
		var xhr = new XMLHttpRequest();
		xhr.open('POST', url, true);
		xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
		xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
		xhr.onreadystatechange = function() {
			if (xhr.readyState !== 4) return;
			if (xhr.status >= 200 && xhr.status < 300) {
				try { resolve(JSON.parse(xhr.responseText)); }
				catch (e) { resolve({ out: xhr.responseText }); }
			} else {
				reject(xhr.status + ' ' + xhr.statusText);
			}
		};
		var body = Object.keys(data).map(function(k) {
			return encodeURIComponent(k) + '=' + encodeURIComponent(data[k]);
		}).join('&');
		// CSRF token：必须以表单字段 token 放进 POST body
		if (L.env && L.env.token)
			body += '&token=' + encodeURIComponent(L.env.token);
		xhr.send(body);
	});
}

function log(msg) {
	var el = document.getElementById('srun_log');
	if (!el) return;
	if (!msg) return;
	var ts = new Date().toLocaleString();
	var line = E('div', { 'class': 'srun-log-line' }, [
		E('span', { 'class': 'srun-log-ts' }, '[' + ts + '] '),
		document.createTextNode(msg)
	]);
	el.appendChild(line);
	while (el.childNodes.length > 200)
		el.removeChild(el.firstChild);
	el.scrollTop = el.scrollHeight;
}

function getConfig() {
	return new Promise(function(resolve, reject) {
		var url = L.url('admin/services/srun_login', 'config');
		var xhr = new XMLHttpRequest();
		xhr.open('GET', url, true);
		xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
		xhr.onreadystatechange = function() {
			if (xhr.readyState !== 4) return;
			if (xhr.status >= 200 && xhr.status < 300) {
				try { resolve(JSON.parse(xhr.responseText)); }
				catch (e) { resolve({}); }
			} else {
				resolve({});
			}
		};
		xhr.send();
	});
}

function getLog() {
	return new Promise(function(resolve, reject) {
		var url = L.url('admin/services/srun_login', 'log');
		var xhr = new XMLHttpRequest();
		xhr.open('GET', url, true);
		xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
		xhr.onreadystatechange = function() {
			if (xhr.readyState !== 4) return;
			if (xhr.status >= 200 && xhr.status < 300) {
				try { resolve(JSON.parse(xhr.responseText)); }
				catch (e) { resolve({}); }
			} else {
				resolve({});
			}
		};
		xhr.send();
	});
}

return view.extend({
	load: function() {
		var self = this;
		return Promise.all([ getConfig(), getLog() ]).then(function(res) {
			self._historyLog = (res[1] && res[1].log) || '';
			return res[0];
		});
	},

	getOperator: function() {
		var el = document.getElementById('srun_operator');
		return (el && el.value) ? el.value : '';
	},

	// 切换某账号的开机自动登录（单选：勾选一个会取消其他账号的勾选）
	// 统一同步：checkbox 勾选态、卡片高亮、徽章、acc.autologin 全部一致
	toggleAccountAutologin: function(acc, checked) {
		var self = this;

		// 遍历所有卡片，按「目标账号是否等于当前账号」统一设置状态
		var box = this._tabBox;
		if (box) {
			for (var i = 0; i < box.children.length; i++) {
				var t = box.children[i];
				var isTarget = (t._acc === acc);
				var on = checked && isTarget;
				if (t._acc) t._acc.autologin = on;
				var cb = t.querySelector('.srun-autologin-cb');
				if (cb) cb.checked = on;
				var badge = t.querySelector('.srun-badge');
				if (badge) {
					badge.className = on ? 'srun-badge srun-badge-auto' : 'srun-badge srun-badge-idle';
					badge.textContent = on ? _('自动') : _('未启用');
				}
				if (on)
					t.classList.add('srun-tab-active');
				else
					t.classList.remove('srun-tab-active');
			}
		}

		postForm('config', {
			action: 'autologin',
			enabled: checked ? '1' : '0',
			username: acc.username,
			operator: acc.operator || ''
		})
			.then(function() {
				self.log(checked ? _('已设置开机自动登录: ') + (acc.name || acc.username)
						: _('已取消开机自动登录: ') + (acc.name || acc.username));
			})
			.catch(function(err) {
				self.log(_('设置开机自动登录失败: ') + err);
			});
	},

	doLogin: function() {
		var self = this;
		var username = document.getElementById('srun_username').value.trim();
		var password = document.getElementById('srun_password').value;
		var operator = this.getOperator();
		if (!username || !password) {
			ui.addNotification(null, E('p', _('账号和密码不能为空')), 'error');
			return;
		}

		var doSubmit = function() {
			self.log(_('正在登录 ') + username + (operator ? ('@' + operator) : '') + ' ...');
			postForm('login', { username: username, password: password, operator: operator })
				.then(function(res) {
					var out = res.out || '';
					self.log(out);
				})
				.catch(function(err) {
					self.log(_('登录失败: ') + err);
				});
		};

		var doSave = function() {
			postForm('config', { action: 'save', username: username, password: password, operator: operator })
				.then(function(res) {
					self.log(_('账号已保存: ') + (res.account && res.account.name ? res.account.name : username));
					if (res.account)
						self.addAccountTab(res.account);
				})
				.catch(function(err) { self.log(_('保存失败: ') + err); });
		};

		// 先检测是否已保存过（username + operator 同时相同）
		var existing = this.findAccountTab({ username: username, operator: operator });
		if (existing) {
			// 已保存，直接登录，不询问
			doSubmit();
		} else {
			// 未保存，询问是否保存
			this.confirmSave(username, operator, function(save) {
				if (save)
					doSave();
				doSubmit();
			});
		}
	},

	confirmSave: function(username, operator, cb) {
		var label = username + (operator ? ('@' + operator) : '');
		var resolved = false;
		var confirmSave = function(flag) {
			if (resolved) return;
			resolved = true;
			cb(!!flag);
		};
		ui.showModal(_('保存账号密码'), [
			E('p', {}, [ _('是否保存当前账号密码（') , E('strong', {}, label), _('）为右侧列表中的一个标签按钮？') ]),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-apply', 'click': function() { ui.hideModal(); confirmSave(true); } }, _('保存')),
				' ',
				E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'click': function() { ui.hideModal(); confirmSave(false); } }, _('不保存'))
			])
		]);
	},

	doLogout: function() {
		var self = this;
		self.log(_('正在注销 ...'));
		postForm('logout', {})
			.then(function(res) {
				self.log(res.out || '');
			})
			.catch(function(err) {
				self.log(_('注销失败: ') + err);
			});
	},

	deleteAccount: function(acc, card) {
		var self = this;
		// 若有卡片，先播放删除动画（塌陷 + 位移），动画结束后再做删除请求
		var doDelete = function() {
			postForm('config', { action: 'delete', username: acc.username, operator: acc.operator || '' })
				.then(function() {
					self.log(_('已删除账号: ') + (acc.name || acc.username));
					// 删除后重新拉取列表，重建卡片，避免索引过期导致残留/错位
					self.reloadAccounts();
				})
				.catch(function(err) { self.log(_('删除失败: ') + err); });
		};

		if (card && card.classList) {
			card.classList.add('srun-tab-removing');
			// 监听过渡结束，或兜底用定时器
			var done = false;
			var finish = function() {
				if (done) return;
				done = true;
				doDelete();
			};
			card.addEventListener('transitionend', function(ev) {
				if (ev.propertyName === 'height' || ev.propertyName === 'opacity')
					finish();
			});
			setTimeout(finish, 350);
		} else {
			doDelete();
		}
	},

	reloadAccounts: function() {
		var self = this;
		getConfig().then(function(data) {
			var accounts = (data && data.accounts) || [];
			self.renderAccounts(accounts);
		});
	},

	renderAccounts: function(accounts) {
		var self = this;
		var box = this._tabBox;
		if (!box) return;
		box.innerHTML = '';
		accounts.forEach(function(acc) {
			box.appendChild(self.makeAccountTab(acc));
		});
		if (this._tabsRow) {
			this._tabsRow.style.display = accounts.length > 0 ? '' : 'none';
		}
	},

	selectAccount: function(acc) {
		document.getElementById('srun_username').value = acc.username || '';
		document.getElementById('srun_password').value = acc.password || '';
		var opEl = document.getElementById('srun_operator');
		if (opEl)
			opEl.value = acc.operator || '';
	},

	log: function(msg) {
		log(msg);
	},

	makeAccountTab: function(acc) {
		var self = this;
		var name = acc.name || acc.username;
		// 展示用账号串：用户名（无运营商时不展示后缀）
		var displayUser = acc.username + (acc.operator ? ('@' + acc.operator) : '');
		var isAuto = !!acc.autologin;

		// 状态徽章（简短）
		var badge = isAuto
			? E('span', { 'class': 'srun-badge srun-badge-auto' }, _('自动'))
			: E('span', { 'class': 'srun-badge srun-badge-idle' }, _('未启用'));

		// 自动登录开关（原生 checkbox）
		var autoCb = E('input', {
			'class': 'srun-autologin-cb',
			'type': 'checkbox',
			'checked': isAuto ? 'checked' : null,
			'change': function(ev) {
				ev.stopPropagation();
				self.toggleAccountAutologin(tab._acc || acc, this.checked);
			}
		});
		var autoWrap = E('label', {
			'class': 'srun-autologin-wrap',
			'title': _('设为开机自动登录')
		}, [ autoCb, E('span', { 'class': 'srun-autologin-text' }, _('自动登录')) ]);

		// 删除按钮（轻量文字样式）
		var delBtn = E('a', {
			'class': 'srun-tab-delete',
			'title': _('删除该账号'),
			'click': function(ev) {
				ev.stopPropagation();
				self.deleteAccount(tab._acc || acc, tab);
			}
		}, _('删除'));

		var tab = E('div', {
			'class': 'srun-tab' + (isAuto ? ' srun-tab-active' : ''),
			'click': function() { self.selectAccount(tab._acc || acc); }
		}, [
			E('div', { 'class': 'srun-tab-head' }, [
				E('span', { 'class': 'srun-tab-name' }, name),
				badge
			]),
			E('div', { 'class': 'srun-tab-info' }, displayUser),
			E('div', { 'class': 'srun-tab-foot' }, [
				autoWrap,
				delBtn
			])
		]);
		tab._acc = acc;
		return tab;
	},

	// 按 username + operator 查找已存在的标签，不存在返回 null
	findAccountTab: function(acc) {
		var box = this._tabBox;
		if (!box) return null;
		for (var i = 0; i < box.children.length; i++) {
			var t = box.children[i];
			var a = t._acc;
			if (a && a.username === acc.username && (a.operator || '') === (acc.operator || ''))
				return t;
		}
		return null;
	},

	addAccountTab: function(acc) {
		var self = this;
		var box = this._tabBox;
		if (!box) {
			// 初始无已保存账号时，动态创建右侧栏并追加到左右分栏容器
			box = E('div', { 'class': 'srun-accounts' });
			this._tabBox = box;
			var tabsCol = E('div', { 'class': 'srun-right' }, [
				E('div', { 'class': 'srun-right-title' }, _('已保存账号')),
				box,
				E('div', { 'class': 'srun-autologin-hint' }, _('勾选卡片右下角“自动登录”复选框即可设为开机自动登录（仅一个）'))
			]);
			this._tabsRow = tabsCol;
			var layout = document.querySelector('.srun-layout');
			if (layout)
				layout.appendChild(tabsCol);
		}

		// 去重：同账号+运营商已存在则更新引用与标签文本，不重复添加
		var existing = this.findAccountTab(acc);
		if (existing) {
			existing._acc = acc;
			var nameEl = existing.querySelector('.srun-tab-name');
			if (nameEl)
				nameEl.textContent = acc.name || acc.username;
			return;
		}

		box.appendChild(this.makeAccountTab(acc));
	},

	handleSaveApply: function(ev, mode) {
		return this.doLogin();
	},

	render: function(data) {
		var self = this;
		var username = E('input', { 'class': 'cbi-input-text', 'type': 'text', 'id': 'srun_username', 'name': 'username' });
		var password = E('input', { 'class': 'cbi-input-text', 'type': 'password', 'id': 'srun_password', 'name': 'password' });

		// 运营商选择（移动 @cmcc / 电信 @ctcc / 联通 @cucc）
		var operator = E('select', { 'class': 'cbi-input-select', 'id': 'srun_operator', 'name': 'operator' }, [
			E('option', { 'value': '' }, _('默认（不选择）')),
			E('option', { 'value': 'cmcc' }, _('中国移动')),
			E('option', { 'value': 'ctcc' }, _('中国电信')),
			E('option', { 'value': 'cucc' }, _('中国联通'))
		]);

		var loginBtn = E('button', { 'class': 'cbi-button cbi-button-apply', 'click': function() { self.doLogin(); } }, _('登录'));
		var logoutBtn = E('button', { 'class': 'cbi-button cbi-button-reset', 'click': function() { self.doLogout(); } }, _('注销'));

		// 日志输出区（样式参考系统日志页）
		var logBox = E('div', { 'class': 'srun-log', 'id': 'srun_log' });
		var clearBtn = E('button', { 'class': 'cbi-button cbi-button-neutral', 'click': function() {
			logBox.innerHTML = '';
			postForm('log', { clear: '1' }).catch(function() {});
		} }, _('清空日志'));

		// 恢复历史日志（若已有）
		if (self._historyLog) {
			var hist = self._historyLog;
			hist.split('\n').forEach(function(ln) {
				var line = E('div', { 'class': 'srun-log-line' }, [ document.createTextNode(ln) ]);
				logBox.appendChild(line);
			});
		}

		// 构建账号选项卡（右侧列表）
		var accounts = (data && data.accounts) || [];
		self._tabBox = null;
		self._tabsRow = null;
		var tabsCol = null;
		if (accounts.length > 0) {
			var tabBox = E('div', { 'class': 'srun-accounts' });
			accounts.forEach(function(acc) {
				tabBox.appendChild(self.makeAccountTab(acc));
			});
			self._tabBox = tabBox;
			tabsCol = E('div', { 'class': 'srun-right' }, [
				E('div', { 'class': 'srun-right-title' }, _('已保存账号')),
				tabBox,
				E('div', { 'class': 'srun-autologin-hint' }, _('勾选卡片右下角“自动登录”复选框即可设为开机自动登录（仅一个）'))
			]);
			self._tabsRow = tabsCol;
		}

		// 左栏：登录表单
		var leftCol = E('div', { 'class': 'srun-left' }, [
			E('div', { 'class': 'cbi-section-descr' }, _('填写账号密码、选择运营商后点击登录。')),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('账号（学号）')),
				E('div', { 'class': 'cbi-value-field' }, [ username ])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('密码')),
				E('div', { 'class': 'cbi-value-field' }, [ password ])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('运营商')),
				E('div', { 'class': 'cbi-value-field' }, [ operator ])
			]),
			E('div', { 'class': 'cbi-page-actions' }, [ loginBtn, logoutBtn ])
		]);

		// 左右分栏容器（有账号时右侧显示账号列表，否则只显示左栏）
		var layoutChildren = [ leftCol ];
		if (tabsCol)
			layoutChildren.push(tabsCol);
		var layout = E('div', { 'class': 'srun-layout' }, layoutChildren);

		// 页面主体：标题 + 左右分栏 + 日志
		return E([], [
			E('style', { 'type': 'text/css' }, [
				'.srun-layout { display:flex; flex-wrap:wrap; gap:20px; align-items:flex-start; max-width:900px; margin:0 auto; }',
				'.srun-left { flex:1 1 380px; min-width:300px; max-width:520px; margin:0 auto; }',
				'.srun-right { flex:0 1 300px; min-width:240px; }',
				'.srun-right-title { display:flex; align-items:center; gap:6px; font-size:14px; font-weight:600; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid var(--border-color, #ddd); }',
				'.srun-accounts { display:flex; flex-direction:column; gap:8px; width:100%; }',
				'.srun-tab { position:relative; display:block; padding:8px 10px; border:1px solid var(--border-color, #d9d9d9); border-radius:5px; background:var(--background-color-light, #fafafa); color:var(--text-color, #333); cursor:pointer; user-select:none; transition: background-color .18s ease, border-color .18s ease, box-shadow .18s ease, transform .18s ease, opacity .3s ease, height .3s ease, margin .3s ease, padding .3s ease; overflow:hidden; }',
				'.srun-tab:hover { border-color:var(--active-color, #3b8bd6); background:var(--background-color, #eef3f8); box-shadow:0 2px 8px rgba(59,139,214,.25); transform:translateY(-1px); }',
				'.srun-tab-active { border-color:var(--active-color, #3b8bd6); background:var(--active-bg, #eef5fc); }',
				'.srun-tab-active:hover { border-color:var(--active-color, #3b8bd6); background:var(--active-bg, #eef5fc); box-shadow:0 2px 8px rgba(59,139,214,.3); transform:translateY(-1px); }',
				'.srun-tab-head { display:flex; align-items:center; justify-content:space-between; gap:6px; }',
				'.srun-tab-name { font-size:13px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
				'.srun-tab-info { margin-top:1px; font-size:11px; color:var(--muted-color, #999); font-family:monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
				'.srun-tab-foot { display:flex; align-items:center; justify-content:space-between; margin-top:6px; gap:6px; }',
				'.srun-badge { display:inline-block; padding:1px 6px; border-radius:9px; font-size:10px; line-height:1.5; white-space:nowrap; flex-shrink:0; }',
				'.srun-badge-auto { background:var(--success-bg, #d7f2e2); color:var(--success-color, #187a3b); }',
				'.srun-badge-idle { background:var(--muted-bg, #ececec); color:var(--muted-color, #999); }',
				'.srun-autologin-wrap { display:inline-flex; align-items:center; gap:6px; cursor:pointer; }',
				'.srun-autologin-cb { width:15px; height:15px; margin:0; cursor:pointer; vertical-align:middle; }',
				'.srun-autologin-text { font-size:12px; color:var(--text-color, #555); user-select:none; }',
				'.srun-tab-delete { font-size:11px; color:var(--danger-color, #c0392b); cursor:pointer; text-decoration:none; flex-shrink:0; }',
				'.srun-tab-delete:hover { text-decoration:underline; }',
				'.srun-autologin-hint { margin-top:6px; font-size:11px; color:var(--muted-color, #aaa); }',
				'.srun-tab-removing { opacity:0; height:0 !important; margin-top:0 !important; margin-bottom:0 !important; padding-top:0 !important; padding-bottom:0 !important; border-width:0 !important; transform: translateX(40px); }',
				'.srun-log-title { margin:16px auto 0; max-width:900px; font-size:14px; font-weight:600; }',
				'.srun-log { margin:6px auto 0; max-width:900px; padding:8px 10px; border:1px solid var(--border-color, #ccc); border-radius:4px; background:var(--log-bg, #1e1e1e); color:var(--log-fg, #8bc34a); font-family:monospace; font-size:12px; max-height:200px; min-height:90px; overflow-y:auto; white-space:pre-wrap; line-height:1.6; }',
				'.srun-log-line { margin:0; }',
				'.srun-log-ts { color:var(--muted-color, #888); }',
				'.srun-title { max-width:900px; margin:0 auto 12px; }',
				'.srun-actions { max-width:900px; margin:0 auto; }'
			]),
			E('h2', { 'class': 'srun-title' }, _('SRUN 校园网认证')),
			layout,
			E('div', { 'class': 'srun-log-title' }, _('运行日志')),
			E('div', {}, [ logBox ]),
			E('div', { 'class': 'cbi-page-actions srun-actions' }, [ clearBtn ])
		]);
	}
});
