import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  fetchRestaurantById,
  fetchRestaurantItems,
} from '../services/restaurantService';
import '../styles/admin.css';

function formatJod(priceFils) {
  return `${(Number(priceFils) / 1000).toFixed(3)} دينار`;
}

export default function RestaurantMenuPage() {
  const { restaurantId } = useParams();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [restaurant, setRestaurant] = useState(null);
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadMenu = async () => {
      setLoading(true);
      setError('');
      setItems([]);
      setSelectedCategory('الكل');

      try {
        const [restData, menuData] = await Promise.all([
          fetchRestaurantById(restaurantId, controller.signal),
          fetchRestaurantItems(restaurantId, controller.signal),
        ]);
        if (!isActive) return;

        setRestaurant(restData.restaurant || restData);
        const menuList = Array.isArray(menuData) ? menuData : menuData.items || [];
        setItems(menuList);
      } catch (err) {
        if (!isActive || err.name === 'AbortError') return;
        if (err.status === 401) {
          await logout();
          navigate('/login', { replace: true });
          return;
        }
        setError(err.message || 'تعذّر تحميل قائمة الطعام');
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadMenu();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [restaurantId, logout, navigate, reloadKey]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(items.map((item) => item.category).filter(Boolean)));
    return ['الكل', ...unique];
  }, [items]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'الكل') return items;
    return items.filter((item) => item.category === selectedCategory);
  }, [items, selectedCategory]);

  if (loading) return <p>جاري تحميل قائمة الطعام...</p>;

  if (error) {
    return (
      <div className="admin-card">
        <p role="alert" className="alert-error">{error}</p>
        <div className="restaurant-actions">
          <button type="button" onClick={() => setReloadKey((k) => k + 1)}>
            إعادة المحاولة
          </button>
          <Link to="/restaurants">العودة إلى المطاعم</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="restaurant-header">
        <div>
          <Link to="/restaurants">← العودة إلى المطاعم</Link>
          <h1>{restaurant?.name || 'قائمة الطعام'}</h1>
          {restaurant?.description && <p className="admin-hint">{restaurant.description}</p>}
        </div>

        {restaurant && (
          <div className="restaurant-actions">
            <span className={restaurant.isOpen ? 'badge-open' : 'badge-closed'}>
              {restaurant.isOpen ? 'مفتوح' : 'مغلق'}
            </span>
            {restaurant.isOpen && (
              <Link to={`/orders/new?restaurantId=${restaurant.id}`}>
                إنشاء طلب من هذا المطعم
              </Link>
            )}
          </div>
        )}
      </div>

      {/* فلترة حسب التصنيف */}
      {categories.length > 1 && (
        <section className="admin-card">
          <div className="restaurant-actions" style={{ marginTop: 0 }}>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={selectedCategory === cat ? '' : 'btn-secondary'}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* قائمة المنتجات */}
      <section className="admin-card">
        <h2>المنتجات ({filteredItems.length})</h2>

        {filteredItems.length === 0 ? (
          <p className="admin-hint">لا توجد منتجات في هذا التصنيف.</p>
        ) : (
          <ul className="admin-list">
            {filteredItems.map((item) => (
              <li
                key={item.id}
                className="restaurant-item"
                style={{ opacity: item.available ? 1 : 0.65 }}
              >
                <div className="restaurant-header">
                  <div>
                    <strong>{item.name}</strong>{' '}
                    <span className="admin-hint">({item.category})</span>
                  </div>
                  <span className={item.available ? 'badge-open' : 'badge-closed'}>
                    {item.available ? 'متوفر' : 'غير متوفر'}
                  </span>
                </div>

                <p style={{ fontWeight: 600 }}>{formatJod(item.priceFils)}</p>

                {!item.available && (
                  <p className="admin-hint" style={{ marginBottom: 0, marginTop: '6px' }}>
                    هذا المنتج غير متاح حالياً ولا يمكن إضافته للسلة.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}