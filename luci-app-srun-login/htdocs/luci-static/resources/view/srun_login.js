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

		// 先询问是否保存当前账号密码
		this.confirmSave(username, operator, function(save) {
			if (save) {
				postForm('config', { action: 'save', username: username, password: password, operator: operator })
					.then(function(res) {
						self.log(_('账号已保存: ') + (res.account && res.account.name ? res.account.name : username));
						if (res.account)
							self.addAccountTab(res.account);
					})
					.catch(function(err) { self.log(_('保存失败: ') + err); });
			}
			doSubmit();
		});
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

	deleteAccount: function(id, tabEl) {
		var self = this;
		postForm('config', { action: 'delete', name: id })
			.then(function() {
				if (tabEl && tabEl.parentNode)
					tabEl.parentNode.removeChild(tabEl);
				if (self._tabBox && self._tabBox.children.length === 0 && self._tabsRow)
					self._tabsRow.style.display = 'none';
			})
			.catch(function(err) { showResult('删除失败: ' + err); });
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
		var tab = E('span', {
			'class': 'srun-tab',
			'click': function() { self.selectAccount(acc); }
		}, [
			acc.name || acc.username,
			E('span', {
				'class': 'srun-tab-close',
				'title': _('删除该账号'),
				'click': function(ev) {
					ev.stopPropagation();
					self.deleteAccount(acc.id, tab);
				}
			}, '×')
		]);
		return tab;
	},

	addAccountTab: function(acc) {
		var self = this;
		var box = this._tabBox;
		if (!box) {
			// 初始无已保存账号时，动态创建标签容器
			box = E('div', { 'class': 'srun-accounts' });
			this._tabBox = box;
			var tabsRow = E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('已保存账号')),
				E('div', { 'class': 'cbi-value-field' }, [ box ])
			]);
			this._tabsRow = tabsRow;
			var actions = document.querySelector('.cbi-page-actions');
			if (actions && actions.parentNode)
				actions.parentNode.insertBefore(tabsRow, actions);
		}
		box.appendChild(this.makeAccountTab(acc));
		if (this._tabsRow)
			this._tabsRow.style.display = '';
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
		var tabsRow = null;
		if (accounts.length > 0) {
			var tabBox = E('div', { 'class': 'srun-accounts' });
			accounts.forEach(function(acc) {
				tabBox.appendChild(self.makeAccountTab(acc));
			});
			self._tabBox = tabBox;
			tabsRow = E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('已保存账号')),
				E('div', { 'class': 'cbi-value-field' }, [ tabBox ])
			]);
			self._tabsRow = tabsRow;
		}

		// 组装界面主体内容（仅在有账号时才加入已保存账号行，避免渲染 null）
		var sectionChildren = [
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
			])
		];
		if (tabsRow)
			sectionChildren.push(tabsRow);
		sectionChildren.push(
			E('div', { 'class': 'cbi-page-actions' }, [ loginBtn, logoutBtn ]),
			E('div', { 'class': 'cbi-section-descr' }, _('运行日志')),
			E('div', {}, [ logBox ]),
			E('div', { 'class': 'cbi-page-actions' }, [ clearBtn ])
		);

		return E([], [
			E('style', { 'type': 'text/css' }, [
				'.srun-accounts { display:flex; flex-wrap:wrap; gap:6px; }',
				'.srun-tab { display:inline-flex; align-items:center; padding:4px 10px; border:1px solid #999; border-radius:3px; background:#f5f5f5; cursor:pointer; user-select:none; }',
				'.srun-tab:hover { background:#e0e0e0; }',
				'.srun-tab-close { margin-left:8px; font-weight:bold; color:#c00; cursor:pointer; padding:0 4px; }',
				'.srun-tab-close:hover { color:#800; }',
				'.srun-log { margin-top:10px; padding:10px; border:1px solid #ccc; border-radius:3px; background:#000; color:#0f0; font-family:monospace; font-size:12px; max-height:240px; min-height:120px; overflow-y:auto; white-space:pre-wrap; }',
				'.srun-log-line { margin:0; }',
				'.srun-log-ts { color:#888; }'
			]),
			E('h2', {}, _('SRUN 校园网认证')),
			E('div', { 'class': 'cbi-map' }, [
				E('div', { 'class': 'cbi-section' }, sectionChildren)
			])
		]);
	}
});
