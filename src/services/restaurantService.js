import { apiRequest } from './apiClient';

// API 05: جلب قائمة المطاعم (مع دعم البحث الاختياري ?q=)
export async function fetchRestaurants(signal, query = '') {
  const path = query.trim()
    ? `/api/restaurants?q=${encodeURIComponent(query.trim())}`
    : '/api/restaurants';
  return apiRequest(path, { signal });
}

// API 06: تفاصيل مطعم
export async function fetchRestaurantById(restaurantId, signal) {
  return apiRequest(`/api/restaurants/${restaurantId}`, { signal });
}

// API 26: إضافة مطعم جديد
export async function createRestaurant({ name, category, description }) {
  return apiRequest('/api/admin/restaurants', {
    method: 'POST',
    body: JSON.stringify({ name, category, description, isOpen: false }),
  });
}

// API 27: تعديل مطعم أو تغيير حالته (isOpen)
export async function updateRestaurant(restaurantId, payload) {
  return apiRequest(`/api/admin/restaurants/${restaurantId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// API 07: جلب منتجات مطعم محدد
export async function fetchRestaurantItems(restaurantId, signal) {
  return apiRequest(`/api/restaurants/${restaurantId}/menu`, { signal });
}

// API 28: إضافة منتج جديد لمطعم محدد
export async function createMenuItem(restaurantId, { name, category, priceFils, available }) {
  return apiRequest(`/api/admin/restaurants/${restaurantId}/menu`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      category,
      priceFils: Number(priceFils),
      available: Boolean(available),
    }),
  });
}

// API 29: تعديل منتج موجود أو تعطيله
export async function updateMenuItem(restaurantId, itemId, payload) {
  return apiRequest(`/api/admin/restaurants/${restaurantId}/menu/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}