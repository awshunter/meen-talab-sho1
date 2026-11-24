import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiRequest } from '../services/apiClient';
import { useAuth } from '../hooks/useAuth';

export default function OrderDetailsPage() {
  const { orderId } = useParams();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadOrder = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest(`/api/orders/${orderId}`, {
          signal: controller.signal,
        });
        if (!isActive) return;
        setOrder(data);
      } catch (err) {
        if (!isActive || err.name === 'AbortError') return;
        if (err.status === 401) {
          await logout();
          navigate('/login', { replace: true });
          return;
        }
        setError(err);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadOrder();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [orderId, logout, navigate]);

  if (loading) return <p>جاري تحميل تفاصيل الطلب...</p>;

  if (error?.status === 404) {
    return (
      <div>
        <h2>404 - الطلب غير موجود</h2>
        <p>لم يتم العثور على طلب بهذا المعرّف.</p>
        <Link to="/orders">العودة إلى طلباتي</Link>
      </div>
    );
  }

  if (error?.status === 403) {
    return (
      <div>
        <h2>403 - غير مسموح</h2>
        <p>ليس لديك صلاحية لعرض هذا الطلب.</p>
        <Link to="/orders">العودة إلى طلباتي</Link>
      </div>
    );
  }

  if (error) return <p>{error.message}</p>;

  return (
    <div>
      <h1>{order.title}</h1>
      <p>الحالة: {order.status}</p>

      {/* ملخص المنظّم وأزرار الإدارة تظهر للمنظّم فقط */}
      {order.isOrganizer && (
        <div>
          <Link to={`/orders/${orderId}/summary`}>عرض ملخص المنظّم</Link>
        </div>
      )}
    </div>
  );
}