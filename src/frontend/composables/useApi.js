/**
 * useApi - HTTP 请求工具 composable
 *
 * 封装 fetch 调用，提供 JSON 序列化/反序列化和 401 自动跳转。
 * 从原 src/public/js/app.js 的 fetchJSON/postJSON/putJSON/deleteJSON 迁移。
 */

/**
 * 统一响应错误处理
 * @param {Response} res - fetch 响应
 * @returns {Promise<any>}
 */
async function handleResponse(res) {
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('未授权，跳转登录');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.reason || data.error || `请求失败: ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return res.json();
}

/**
 * GET 请求
 * @param {string} url
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<any>}
 */
export async function fetchJSON(url, options = {}) {
  const res = await fetch(url, { signal: options.signal });
  return handleResponse(res);
}

/**
 * POST 请求
 * @param {string} url
 * @param {object} [body]
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<any>}
 */
export async function postJSON(url, body, options = {}) {
  const fetchOptions = { method: 'POST', signal: options.signal };
  if (body !== undefined) {
    fetchOptions.headers = { 'Content-Type': 'application/json' };
    fetchOptions.body = JSON.stringify(body);
  }
  const res = await fetch(url, fetchOptions);
  return handleResponse(res);
}

/**
 * PUT 请求
 * @param {string} url
 * @param {object} body
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<any>}
 */
export async function putJSON(url, body, options = {}) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
  });
  return handleResponse(res);
}

/**
 * DELETE 请求
 * @param {string} url
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<any>}
 */
export async function deleteJSON(url, options = {}) {
  const res = await fetch(url, { method: 'DELETE', signal: options.signal });
  return handleResponse(res);
}

/**
 * useApi composable
 *
 * 返回所有 HTTP 工具函数，供 Vue 组件或 Pinia stores 使用。
 */
export function useApi() {
  return { fetchJSON, postJSON, putJSON, deleteJSON };
}
