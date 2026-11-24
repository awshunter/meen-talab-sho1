import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  fetchRestaurants,
  fetchRestaurantItems,
  createMenuItem,
  updateMenuItem,
  updateRestaurant,
} from '../services/restaurantService';
import '../styles/admin.css';

function formatFils(fils) {
  return `${(Number(fils) / 1000).toFixed(3)} د.أ (${fils} فلس)`;
}

export default function AdminMenuPage() {
  const { restaurantId } = useParams();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [restaurant, setRestaurant] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  // نموذج إضافة منتج جديد
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [priceFils, setPriceFils] = useState('');
  const [available, setAvailable] = useState(true);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  // نموذج تعديل منتج
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPriceFils, setEditPriceFils] = useState('');
  const [editAvailable, setEditAvailable] = useState(true);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadData = async () => {
      setLoading(true);
      setPageError('');
      try {
        const [restaurantsData, itemsData] = await Promise.all([
          fetchRestaurants(controller.signal),
          fetchRestaurantItems(restaurantId, controller.signal),
        ]);
        if (!isActive) return;

        const list = Array.isArray(restaurantsData)
          ? restaurantsData
          : restaurantsData.restaurants || [];
        const currentRest = list.find((r) => String(r.id) === String(restaurantId)) || null;
        setRestaurant(currentRest);

        const itemsList = Array.isArray(itemsData) ? itemsData : itemsData.items || [];
        setItems(itemsList);
      } catch (err) {
        if (!isActive || err.name === 'AbortError') return;
        if (err.status === 401) {
          await logout();
          navigate('/login', { replace: true });
          return;
        }
        setPageError(err.message || 'تعذّر تحميل منتجات المطعم');
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadData();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [restaurantId, logout, navigate]);

  const availableCount = items.filter((item) => item.available).length;

  // إضافة منتج
  const handleCreate = async (e) => {
    e.preventDefault();
    if (creating) return;

    const parsedPrice = Number(priceFils);
    if (!name.trim() || !category.trim() || !Number.isInteger(parsedPrice) || parsedPrice <= 0) {
      setCreateError('يرجى إدخال الاسم والتصنيف وسعر صحيح بالفلس (رقم صحيح أكبر من 0)');
      return;
    }

    setCreating(true);
    setCreateError('');
    try {
      const created = await createMenuItem(restaurantId, {
        name: name.trim(),
        category: category.trim(),
        priceFils: parsedPrice,
        available,
      });
      const newItem = created.item || created;
      setItems((prev) => [...prev, newItem]);
      setName('');
      setCategory('');
      setPriceFils('');
      setAvailable(true);
    } catch (err) {
      if (err.status === 401) {
        await logout();
        navigate('/login', { replace: true });
        return;
      }
      setCreateError(err.message || 'تعذّر إضافة المنتج');
    } finally {
      setCreating(false);
    }
  };

  // بدء التعديل
  const startEdit = (item) => {
    setEditingId(item.id);
    setEditName(item.name || '');
    setEditCategory(item.category || '');
    setEditPriceFils(String(item.priceFils ?? ''));
    setEditAvailable(Boolean(item.available));
    setEditError('');
  };

  // حفظ التعديل (بدون تغيير restaurantId)
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (savingEdit || !editingId) return;

    const parsedPrice = Number(editPriceFils);
    if (!editName.trim() || !editCategory.trim() || !Number.isInteger(parsedPrice) || parsedPrice <= 0) {
      setEditError('يرجى إدخال الاسم والتصنيف وسعر صحيح بالفلس');
      return;
    }

    const originalItem = items.find((i) => i.id === editingId);
    const isDisablingLastAvailable =
      restaurant?.isOpen && originalItem?.available && !editAvailable && availableCount === 1;

    if (isDisablingLastAvailable) {
      const confirmed = window.confirm(
        'تنبيه: هذا آخر منتج متاح والمطعم مفتوح! تعطيله لن يغلق المطعم تلقائياً لكن سيُرفض إنشاء الطلبات منه بـ MENU_EMPTY. هل تريد المتابعة؟'
      );
      if (!confirmed) return;
    }

    setSavingEdit(true);
    setEditError('');
    try {
      const updated = await updateMenuItem(restaurantId, editingId, {
        name: editName.trim(),
        category: editCategory.trim(),
        priceFils: parsedPrice,
        available: editAvailable,
      });
      const updatedItem = updated.item || updated;
      setItems((prev) => prev.map((i) => (i.id === editingId ? updatedItem : i)));
      setEditingId(null);
    } catch (err) {
      if (err.status === 401) {
        await logout();
        navigate('/login', { replace: true });
        return;
      }
      setEditError(err.message || 'تعذّر حفظ تعديلات المنتج');
    } finally {
      setSavingEdit(false);
    }
  };

  // تبديل حالة التوفر (available)
  const handleToggleAvailable = async (item) => {
    if (busyId) return;

    const isDisablingLastAvailable =
      restaurant?.isOpen && item.available && availableCount === 1;

    if (isDisablingLastAvailable) {
      const confirmed = window.confirm(
        'تنبيه: هذا آخر منتج متاح والمطعم مفتوح! يُفضّل إغلاق المطعم أولاً، وإلا سيُرفض إنشاء الطلبات منه وتعديله بـ MENU_EMPTY. هل تريد المتابعة؟'
      );
      if (!confirmed) return;
    }

    setBusyId(item.id);
    setActionError('');
    try {
      const updated = await updateMenuItem(restaurantId, item.id, {
        available: !item.available,
      });
      const updatedItem = updated.item || updated;
      setItems((prev) => prev.map((i) => (i.id === item.id ? updatedItem : i)));
    } catch (err) {
      if (err.status === 401) {
        await logout();
        navigate('/login', { replace: true });
        return;
      }
      setActionError(err.message || 'تعذّر تغيير حالة توفر المنتج');
    } finally {
      setBusyId(null);
    }
  };

  // إغلاق/فتح المطعم مباشرة من نفس الصفحة
  const handleToggleRestaurantOpen = async () => {
    if (!restaurant) return;
    setActionError('');
    try {
      const updated = await updateRestaurant(restaurant.id, {
        isOpen: !restaurant.isOpen,
      });
      setRestaurant(updated.restaurant || updated);
    } catch (err) {
      setActionError(err.message || 'تعذّر تغيير حالة المطعم');
    }
  };

  if (loading) return <p>جاري تحميل منتجات المطعم...</p>;
  if (pageError) return <p role="alert" className="alert-error">{pageError}</p>;

  return (
    <div className="admin-page">
      <div className="restaurant-header">
        <div>
          <Link to="/admin/restaurants">← العودة لإدارة المطاعم</Link>
          <h1>منتجات مطعم: {restaurant?.name || restaurantId}</h1>
        </div>
        {restaurant && (
          <div className="restaurant-actions">
            <span className={restaurant.isOpen ? 'badge-open' : 'badge-closed'}>
              {restaurant.isOpen ? 'مفتوح' : 'مغلق'}
            </span>
            <button type="button" className="btn-secondary" onClick={handleToggleRestaurantOpen}>
              {restaurant.isOpen ? 'إغلاق المطعم أولاً' : 'فتح المطعم'}
            </button>
          </div>
        )}
      </div>

      {/* نموذج إضافة منتج */}
      <section className="admin-card">
        <h2>إضافة منتج جديد</h2>
        {createError && <p role="alert" className="alert-error">{createError}</p>}

        <form onSubmit={handleCreate} className="admin-form" noValidate>
          <div className="auth-field">
            <label htmlFor="item-name">اسم المنتج</label>
            <input
              id="item-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={creating}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="item-category">التصنيف</label>
            <input
              id="item-category"
              type="text"
              placeholder="مثال: ساندويشات، مشروبات"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={creating}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="item-price">السعر بالفلس (مثال: 1500 = 1.500 د.أ)</label>
            <input
              id="item-price"
              type="number"
              min="1"
              step="1"
              value={priceFils}
              onChange={(e) => setPriceFils(e.target.value)}
              disabled={creating}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              style={{ width: 'auto' }}
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
              disabled={creating}
            />
            المنتج متوفر حالياً
          </label>

          <div>
            <button type="submit" disabled={creating}>
              {creating ? 'جاري الإضافة...' : 'إضافة منتج'}
            </button>
          </div>
        </form>
      </section>

      {/* قائمة المنتجات */}
      <section className="admin-card">
        <h2>قائمة المنتجات ({items.length}) — المتاح منها: {availableCount}</h2>
        {actionError && <p role="alert" className="alert-error">{actionError}</p>}

        {items.length === 0 ? (
          <p className="admin-hint">لا توجد منتجات لهذا المطعم بعد.</p>
        ) : (
          <ul className="admin-list">
            {items.map((item) => (
              <li key={item.id} className="restaurant-item">
                {editingId === item.id ? (
                  <form onSubmit={handleSaveEdit} className="admin-form" noValidate>
                    {editError && <p role="alert" className="alert-error">{editError}</p>}
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="اسم المنتج"
                      disabled={savingEdit}
                    />
                    <input
                      type="text"
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      placeholder="التصنيف"
                      disabled={savingEdit}
                    />
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={editPriceFils}
                      onChange={(e) => setEditPriceFils(e.target.value)}
                      placeholder="السعر بالفلس"
                      disabled={savingEdit}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        style={{ width: 'auto' }}
                        checked={editAvailable}
                        onChange={(e) => setEditAvailable(e.target.checked)}
                        disabled={savingEdit}
                      />
                      متوفر
                    </label>
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
                        <strong>{item.name}</strong>{' '}
                        <span className="admin-hint">({item.category})</span>
                      </div>
                      <span className={item.available ? 'badge-open' : 'badge-closed'}>
                        {item.available ? 'متوفر' : 'غير متوفر'}
                      </span>
                    </div>

                    <p>{formatFils(item.priceFils)}</p>

                    <div className="restaurant-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => startEdit(item)}
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleAvailable(item)}
                        disabled={busyId === item.id}
                      >
                        {item.available ? 'إيقاف المنتج' : 'تفعيل المنتج'}
                      </button>
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