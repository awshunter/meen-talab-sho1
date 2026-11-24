import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiRequest } from '../services/apiClient';
import { useAuth } from '../hooks/useAuth';

export default function OrganizerSummaryPage() {
  const { orderId } = useParams();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadSummary = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest(`/api/orders/${orderId}/summary`);
        setSummary(data);
      } catch (err) {
        if (err.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [orderId, logout, navigate]);

  if (loading) return <p>جاري تحميل ملخص المنظّم...</p>;

  if (error?.status === 403) {
    return (
      <div>
        <h2>403 - غير مسموح</h2>
        <p>هذه الصفحة متاحة لمنظّم الطلب فقط.</p>
        <Link to={`/orders/${orderId}`}>العودة لتفاصيل الطلب</Link>
      </div>
    );
  }

  if (error?.status === 404) {
    return (
      <div>
        <h2>404 - الطلب غير موجود</h2>
        <Link to="/orders">العودة إلى طلباتي</Link>
      </div>
    );
  }

  if (error) return <p>{error.message}</p>;

  return (
    <div>
      <h1>ملخص المنظّم</h1>
      <pre>{JSON.stringify(summary, null, 2)}</pre>
    </div>
  );
}