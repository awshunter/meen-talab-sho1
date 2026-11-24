import { apiRequest } from './apiClient';

// API 08: إنشاء طلب جماعي جديد
export async function createGroupOrder(payload) {
  return apiRequest('/api/group-orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}