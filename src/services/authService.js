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
    // نرمي كائن الخطأ اللي رجع من السيرفر (فيه message و fields)
    throw data.error || { message: 'حدث خطأ أثناء إنشاء الحساب' };
  }

  return data;
}
