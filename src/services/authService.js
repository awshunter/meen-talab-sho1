export async function registerUser({ name, email, password }) {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw data.error || { message: 'حدث خطأ أثناء إنشاء الحساب' };
  }

  return data;
}

export async function loginUser({ email, password }) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw result.error || { message: 'بيانات الدخول غير صحيحة' };
  }

  return result.data || result;
}

export async function fetchCurrentUser(token) {
    const response = await fetch('/api/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const result = await response.json();
  if (!response.ok) {
    throw result.error || { message: 'الجلسة غير صالحة أو منتهية' };
  }

  return result.data || result;
}
