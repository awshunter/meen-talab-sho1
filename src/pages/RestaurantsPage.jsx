import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchRestaurants } from '../services/restaurantService';
import '../styles/admin.css';

export default function RestaurantsPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [restaurants, setRestaurants] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadRestaurants = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchRestaurants(controller.signal);
        if (!isActive) return;
        setRestaurants(Array.isArray(data) ? data : data.restaurants || []);
      } catch (err) {
        if (!isActive || err.name === 'AbortError') return;
        if (err.status === 401) {
          await logout();
          navigate('/login', { replace: true });
          return;
        }
        setError(err.message || 'تعذّر تحميل قائمة المطاعم');
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadRestaurants();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [logout, navigate, reloadKey]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredRestaurants = restaurants.filter((restaurant) => {
    if (!normalizedQuery) return true;
    const nameMatch = restaurant.name?.toLowerCase().includes(normalizedQuery);
    const categoryMatch = restaurant.category?.toLowerCase().includes(normalizedQuery);
    return nameMatch || categoryMatch;
  });

  return (
    <div className="admin-page">
      <div className="restaurant-header">
        <h1>المطاعم</h1>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setReloadKey((k) => k + 1)}
          disabled={loading}
        >
          تحديث القائمة
        </button>
      </div>

      {/* شريط البحث بالاسم أو التصنيف */}
      <section className="admin-card">
        <div className="auth-field">
          <label htmlFor="restaurant-search">ابحث عن مطعم بالاسم أو التصنيف</label>
          <input
            id="restaurant-search"
            type="search"
            placeholder="مثال: برغر، وجبات عربية، قهوة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </section>

      {/* حالة التحميل */}
      {loading && <p>جاري تحميل قائمة المطاعم...</p>}

      {/* حالة الخطأ مع زر Retry */}
      {!loading && error && (
        <div className="admin-card">
          <p role="alert" className="alert-error">
            {error}
          </p>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)}>
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* حالة الفراغ (لا توجد مطاعم أو البحث لا يطابق شيئاً) */}
      {!loading && !error && filteredRestaurants.length === 0 && (
        <div className="admin-card">
          {normalizedQuery ? (
            <>
              <p className="admin-hint">
                لا توجد مطاعم تطابق البحث "{searchQuery.trim()}".
              </p>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSearchQuery('')}
              >
                مسح البحث
              </button>
            </>
          ) : (
            <p className="admin-hint">لا توجد مطاعم متاحة حالياً.</p>
          )}
        </div>
      )}

      {/* قائمة المطاعم */}
      {!loading && !error && filteredRestaurants.length > 0 && (
        <ul className="admin-list">
          {filteredRestaurants.map((restaurant) => (
            <li
              key={restaurant.id}
              className="restaurant-item"
              style={{ opacity: restaurant.isOpen ? 1 : 0.78 }}
            >
              <div className="restaurant-header">
                <div>
                  <strong>{restaurant.name}</strong>{' '}
                  <span className="admin-hint">({restaurant.category})</span>
                </div>
                <span className={restaurant.isOpen ? 'badge-open' : 'badge-closed'}>
                  {restaurant.isOpen ? 'مفتوح' : 'مغلق'}
                </span>
              </div>

              {restaurant.description && <p>{restaurant.description}</p>}

              <div className="restaurant-actions">
                <Link to={`/restaurants/${restaurant.id}`}>عرض القائمة</Link>

                {restaurant.isOpen ? (
                  <Link to={`/orders/new?restaurantId=${restaurant.id}`}>
                    إنشاء طلب من هذا المطعم
                  </Link>
                ) : (
                  <button type="button" disabled>
                    المطعم مغلق — لا يمكن إنشاء طلب
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}