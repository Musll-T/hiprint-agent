/**
 * 登录页前端逻辑
 *
 * 表单提交 -> POST /api/login -> 成功后跳转到 /
 */

(function () {
  'use strict';

  var form = document.getElementById('loginForm');
  var errorEl = document.getElementById('loginError');
  var loginBtn = document.getElementById('loginBtn');
  var usernameInput = document.getElementById('username');
  var passwordInput = document.getElementById('password');

  /**
   * 显示错误提示
   * @param {string} message - 错误消息
   */
  function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.add('visible');
  }

  /** 隐藏错误提示 */
  function hideError() {
    errorEl.classList.remove('visible');
  }

  /**
   * 设置按钮加载状态
   * @param {boolean} loading - 是否处于加载中
   */
  function setLoading(loading) {
    loginBtn.disabled = loading;
    loginBtn.textContent = loading ? '登录中...' : '登录';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    hideError();

    var username = usernameInput.value.trim();
    var password = passwordInput.value;

    if (!username || !password) {
      showError('请输入用户名和密码');
      return;
    }

    setLoading(true);

    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok) {
          // 登录成功，跳转到主面板
          window.location.href = '/';
        } else {
          showError(result.data.error || '登录失败');
          setLoading(false);
        }
      })
      .catch(function () {
        showError('网络异常，请稍后重试');
        setLoading(false);
      });
  });

  // 输入时清除错误提示
  usernameInput.addEventListener('input', hideError);
  passwordInput.addEventListener('input', hideError);
})();
