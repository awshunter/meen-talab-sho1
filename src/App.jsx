import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import MyOrdersPage from './pages/MyOrdersPage';
import RestaurantsPage from './pages/RestaurantsPage';
import RestaurantMenuPage from './pages/RestaurantMenuPage';
import CreateOrderPage from './pages/CreateOrderPage';
import JoinOrderPage from './pages/JoinOrderPage';
import OrderDetailsPage from './pages/OrderDetailsPage';
import MyCartPage from './pages/MyCartPage';
import OrganizerSummaryPage from './pages/OrganizerSummaryPage';
import ProfilePage from './pages/ProfilePage';
import AdminRestaurantsPage from './pages/AdminRestaurantsPage';
import AdminMenuPage from './pages/AdminMenuPage';
import NotFoundPage from './pages/NotFoundPage';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

export default function App() {
  return (
    <AuthProvider>
    <BrowserRouter>
      <Routes>
        
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* الصفحات الداخلية (داخل Layout) */}
        <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/orders" replace />} />
          <Route path="orders" element={<MyOrdersPage />} />
          <Route path="orders/new" element={<CreateOrderPage />} />
          <Route path="orders/join" element={<JoinOrderPage />} />
          <Route path="orders/:orderId" element={<OrderDetailsPage />} />
          <Route path="orders/:orderId/cart" element={<MyCartPage />} />
          <Route path="orders/:orderId/summary" element={<OrganizerSummaryPage />} />

          <Route path="restaurants" element={<RestaurantsPage />} />
          <Route path="restaurants/:restaurantId" element={<RestaurantMenuPage />} />

          <Route path="profile" element={<ProfilePage />} />

          {/* صفحات الأدمن */}
        <Route element={<AdminRoute />}>
          <Route path="admin/restaurants" element={<AdminRestaurantsPage />} />
          <Route path="admin/restaurants/:restaurantId/items" element={<AdminMenuPage />} />
        </Route>
        </Route>
        </Route>


        {/* صفحة غير موجودة 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
    </AuthProvider>
  );
}