import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  fetchRestaurants,
  createRestaurant,
  updateRestaurant,
} from '../services/restaurantService';
import '../styles/admin.css';


export default function AdminRestaurantsPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  // حالة نموذج إضافة مطعم جديد
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  // حالة نموذج التعديل
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // حالة أخطاء زر الفتح/الإغلاق
  const [toggleError, setToggleError] = useState('');
  const [togglingId, setTogglingId] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadRestaurants = async () => {
      setLoading(true);
      setPageError('');
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
        setPageError(err.message || 'تعذّر تحميل قائمة المطاعم');
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadRestaurants();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [logout, navigate]);

  // إضافة مطعم جديد
  const handleCreate = async (e) => {
    e.preventDefault();
    if (creating) return;

    if (!name.trim() || !category.trim()) {
      setCreateError('يرجى إدخال اسم المطعم والتصنيف');
      return;
    }

    setCreating(true);
    setCreateError('');
    try {
      const created = await createRestaurant({
        name: name.trim(),
        category: category.trim(),
        description: description.trim(),
      });
      const newRestaurant = created.restaurant || created;
      setRestaurants((prev) => [...prev, newRestaurant]);
      setName('');
      setCategory('');
      setDescription('');
    } catch (err) {
      if (err.status === 401) {
        await logout();
        navigate('/login', { replace: true });
        return;
      }
      setCreateError(err.message || 'تعذّر إضافة المطعم');
    } finally {
      setCreating(false);
    }
  };

  // بدء التعديل
  const startEdit = (restaurant) => {
    setEditingId(restaurant.id);
    setEditName(restaurant.name || '');
    setEditCategory(restaurant.category || '');
    setEditDescription(restaurant.description || '');
    setEditError('');
  };

  // حفظ التعديل
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (savingEdit || !editingId) return;

    if (!editName.trim() || !editCategory.trim()) {
      setEditError('يرجى إدخال اسم المطعم والتصنيف');
      return;
    }

    setSavingEdit(true);
    setEditError('');
    try {
      const updated = await updateRestaurant(editingId, {
        name: editName.trim(),
        category: editCategory.trim(),
        description: editDescription.trim(),
      });
      const updatedRestaurant = updated.restaurant || updated;
      setRestaurants((prev) =>
        prev.map((r) => (r.id === editingId ? updatedRestaurant : r))
      );
      setEditingId(null);
    } catch (err) {
      if (err.status === 401) {
        await logout();
        navigate('/login', { replace: true });
        return;
      }
      setEditError(err.message || 'تعذّر حفظ التعديلات');
    } finally {
      setSavingEdit(false);
    }
  };

  // تبديل حالة الفتح/الإغلاق (isOpen)
  const handleToggleOpen = async (restaurant) => {
    if (togglingId) return;
    setTogglingId(restaurant.id);
    setToggleError('');

    try {
      const updated = await updateRestaurant(restaurant.id, {
        isOpen: !restaurant.isOpen,
      });
      const updatedRestaurant = updated.restaurant || updated;
      setRestaurants((prev) =>
        prev.map((r) => (r.id === restaurant.id ? updatedRestaurant : r))
      );
    } catch (err) {
      if (err.status === 401) {
        await logout();
        navigate('/login', { replace: true });
        return;
      }
      setToggleError(err.message || 'تعذّر تغيير حالة المطعم');
    } finally {
      setTogglingId(null);
    }
  };

 if (loading) return <p>جاري تحميل المطاعم...</p>;
  if (pageError) return <p role="alert">{pageError}</p>;

 return (
    <div className="admin-page">
      <h1>إدارة المطاعم</h1>

      {/* نموذج إضافة مطعم جديد */}
      <section className="admin-card">
        <h2>إضافة مطعم جديد</h2>
        <p className="admin-hint">المطعم الجديد يُنشأ مغلقاً حتى تُضاف منتجاته.</p>
        {createError && <p role="alert" className="alert-error">{createError}</p>}

        <form onSubmit={handleCreate} className="admin-form" noValidate>
          <div className="auth-field">
            <label htmlFor="rest-name">اسم المطعم</label>
            <input
              id="rest-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={creating}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="rest-category">التصنيف</label>
            <input
              id="rest-category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={creating}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="rest-desc">الوصف</label>
            <textarea
              id="rest-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={creating}
            />
          </div>
          <div>
            <button type="submit" disabled={creating}>
              {creating ? 'جاري الإضافة...' : 'إضافة مطعم'}
            </button>
          </div>
        </form>
      </section>

      {/* قائمة المطاعم الحالية */}
      <section className="admin-card">
        <h2>المطاعم الحالية ({restaurants.length})</h2>
        {toggleError && <p role="alert" className="alert-error">{toggleError}</p>}

        {restaurants.length === 0 ? (
          <p className="admin-hint">لا توجد مطاعم حالياً.</p>
        ) : (
          <ul className="admin-list">
            {restaurants.map((restaurant) => (
              <li key={restaurant.id} className="restaurant-item">
                {editingId === restaurant.id ? (
                  <form onSubmit={handleSaveEdit} className="admin-form" noValidate>
                    {editError && <p role="alert" className="alert-error">{editError}</p>}
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="اسم المطعم"
                      disabled={savingEdit}
                    />
                    <input
                      type="text"
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      placeholder="التصنيف"
                      disabled={savingEdit}
                    />
                    <textarea
                      rows={2}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="الوصف"
                      disabled={savingEdit}
                    />
                    <div className="restaurant-actions">
                      <button type="submit" disabled={savingEdit}>
                        {savingEdit ? 'جاري الحفظ...' : 'حفظ'}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setEditingId(null)}
                        disabled={savingEdit}
                      >
                        إلغاء
                      </button>
                    </div>
                  </form>
                ) : (
                  <div>
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
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => startEdit(restaurant)}
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleOpen(restaurant)}
                        disabled={togglingId === restaurant.id}
                      >
                        {restaurant.isOpen ? 'إغلاق مؤقت' : 'فتح المطعم'}
                      </button>
                      <Link to={`/admin/restaurants/${restaurant.id}/items`}>
                        إدارة المنتجات
                      </Link>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}