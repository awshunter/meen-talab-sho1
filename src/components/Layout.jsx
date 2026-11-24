import React, { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Layout() {
  const { user, isAuthenticated, isCheckingAuth, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isCheckingAuth && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isCheckingAuth, isAuthenticated, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  if (isCheckingAuth) {
    return <p>جاري التحقق من الجلسة...</p>;
  }

  return (
    <div>
      <header>
        <nav>
          <NavLink to="/orders">طلباتي</NavLink> |{' '}
          <NavLink to="/restaurants">المطاعم</NavLink> |{' '}
          <NavLink to="/orders/new">إنشاء طلب</NavLink> |{' '}
          <NavLink to="/orders/join">انضمام لطلب</NavLink> |{' '}
          <NavLink to="/profile">حسابي</NavLink>
          {user?.role === 'admin' && (
            <>
              {' '}| <NavLink to="/admin/restaurants">إدارة المطاعم</NavLink>
            </>
          )}
        </nav>

        <div>
          <span>أهلاً، {user?.name} ({user?.role})</span>{' '}
          <button onClick={handleLogout}>تسجيل الخروج</button>
        </div>
      </header>

      <hr />

      <main>
        <Outlet />
      </main>
    </div>
  );
}