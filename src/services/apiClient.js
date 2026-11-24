const TOKEN_KEY = 'meen_talab_sho_token';

export async function apiRequest(url, options = {}) {
  const token = sessionStorage.getItem(TOKEN_KEY);

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(result.error?.message || 'حدث خطأ في الطلب');
    error.status = response.status;
    error.code = result.error?.code;
    error.fields = result.error?.fields;
    throw error;
  }

  return result.data ?? result;
}