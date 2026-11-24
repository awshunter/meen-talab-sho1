import React from 'react';
import { Link, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function AdminRoute() {
  const { user, isAuthenticated, isCheckingAuth } = useAuth();

  if (isCheckingAuth) {
    return <p>جاري التحقق من الصلاحيات...</p>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'admin') {
    return (
      <div>
        <h2>403 - غير مصرح بالوصول</h2>
        <p>هذه الصفحة مخصصة للمشرفين (Admin) فقط.</p>
        <Link to="/orders">العودة إلى طلباتي</Link>
      </div>
    );
  }

  return <Outlet />;
}