import React from 'react';
import { NavLink, Outlet } from "react-router-dom";

export default function Layout() {
    const userName = 'اسم المستخدم';

    const handlogout = () => {
        console.log('logout clickied');
    }
    return (
        <div>
            <header>
              <nav>
                <NavLink to="/orders">طلباتي</NavLink> |{' '}
                <NavLink to="/restaurants">المطاعم</NavLink> |{' '}
                <NavLink to="/orders/new">إنشاء طلب</NavLink> |{' '}
                <NavLink to="/orders/join">انضمام لطلب</NavLink> |{' '}
                <NavLink to="/profile">حسابي</NavLink> |{' '}
                <NavLink to="/admin/restaurants">إدارة المطاعم</NavLink>
             </nav>
             <div>
               <span>أهلاً، {userName}</span>{' '}
               <button onClick={handlogout}>تسجيل الخروج</button>
             </div>
           </header>
           <hr />

          <main>
          <Outlet />
          </main>
        </div>
    );
}