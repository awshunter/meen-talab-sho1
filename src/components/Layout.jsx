import React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { logoutWarning } = await logout();
    navigate('/login', {
      replace: true,
      state: logoutWarning ? { logoutWarning } : null,
    });
  };

  return (
    <div>
      <header className="app-header">
        <Link to="/orders" className="app-brand">
          مين طالب شو؟
        </Link>

        <nav className="app-nav">
          <NavLink to="/orders" end>طلباتي</NavLink>
          <NavLink to="/restaurants">المطاعم</NavLink>
          <NavLink to="/orders/new">إنشاء طلب</NavLink>
          <NavLink to="/orders/join">انضمام لطلب</NavLink>
          <NavLink to="/profile">حسابي</NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/admin/restaurants">إدارة المطاعم</NavLink>
          )}
        </nav>

        <div className="app-user-bar">
          <span>
            أهلاً، <strong>{user?.name}</strong> ({user?.role})
          </span>
          <button type="button" onClick={handleLogout} className="btn-logout">
            تسجيل الخروج
          </button>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}