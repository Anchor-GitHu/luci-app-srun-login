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
		var token = L.env.requesttoken;
		if (token)
			xhr.setRequestHeader('X-CSRF-Token', token);
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
		xhr.send(body);
	});
}

function showResult(msg) {
	var el = document.getElementById('srun_result');
	if (!el) return;
	el.textContent = msg;
	el.style.display = 'block';
}

return view.extend({
	load: function() {
		return Promise.resolve();
	},

	doLogin: function() {
		var username = document.getElementById('srun_username').value.trim();
		var password = document.getElementById('srun_password').value;
		if (!username || !password) {
			ui.addNotification(null, E('p', _('账号和密码不能为空')), 'error');
			return;
		}
		postForm('login', { username: username, password: password })
			.then(function(res) { showResult(res.out || '已提交'); })
			.catch(function(err) { showResult('失败: ' + err); });
	},

	doLogout: function() {
		postForm('logout', {})
			.then(function(res) { showResult(res.out || '已提交'); })
			.catch(function(err) { showResult('失败: ' + err); });
	},

	handleSaveApply: function(ev, mode) {
		return this.doLogin();
	},

	render: function() {
		var self = this;
		var username = E('input', { 'class': 'cbi-input-text', 'type': 'text', 'id': 'srun_username', 'name': 'username' });
		var password = E('input', { 'class': 'cbi-input-text', 'type': 'password', 'id': 'srun_password', 'name': 'password' });
		var loginBtn = E('button', { 'class': 'cbi-button cbi-button-apply', 'click': function() { self.doLogin(); } }, _('登录'));
		var logoutBtn = E('button', { 'class': 'cbi-button cbi-button-reset', 'click': function() { self.doLogout(); } }, _('注销'));
		var result = E('div', { 'id': 'srun_result', 'style': 'white-space:pre-wrap;display:none;' });

		return E([], [
			E('h2', {}, _('SRUN 校园网认证')),
			E('div', { 'class': 'cbi-map' }, [
				E('div', { 'class': 'cbi-section' }, [
					E('div', { 'class': 'cbi-section-descr' }, _('填写账号密码后点击登录。')),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, _('账号（学号）')),
						E('div', { 'class': 'cbi-value-field' }, [ username ])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, _('密码')),
						E('div', { 'class': 'cbi-value-field' }, [ password ])
					]),
					E('div', { 'class': 'cbi-page-actions' }, [ loginBtn, logoutBtn ]),
					result
				])
			])
		]);
	}
});
