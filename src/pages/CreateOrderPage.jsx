import React, { useEffect, useReducer, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchRestaurants } from '../services/restaurantService';
import { createGroupOrder } from '../services/orderService';
import '../styles/admin.css';

// دالة مساعدة لتوليد وقت افتراضي بصيغة datetime-local
function toLocalDateTimeInput(offsetMinutes) {
  const date = new Date(Date.now() + offsetMinutes * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function createInitialState(defaultRestaurantId = '') {
  return {
    values: {
      restaurantId: defaultRestaurantId,
      title: '',
      closesAt: toLocalDateTimeInput(60),   // بعد ساعة
      expectedAt: toLocalDateTimeInput(120), // بعد ساعتين
      pickupLocation: '',
      deliveryFeeJod: '0',
      note: '',
    },
    errors: {},
    submitting: false,
    serverError: '',
  };
}

function formReducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD':
      return {
        ...state,
        values: { ...state.values, [action.field]: action.value },
        errors: { ...state.errors, [action.field]: '' },
        serverError: '',
      };
    case 'SET_ERRORS':
      return {
        ...state,
        errors: action.errors,
        submitting: false,
      };
    case 'SET_SUBMITTING':
      return {
        ...state,
        submitting: action.value,
        serverError: action.value ? '' : state.serverError,
      };
    case 'SET_SERVER_ERROR':
      return {
        ...state,
        serverError: action.message,
        submitting: false,
      };
    case 'RESET':
      return createInitialState(action.defaultRestaurantId || '');
    default:
      return state;
  }
}

export default function CreateOrderPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRestaurantId = searchParams.get('restaurantId') || '';

  const [restaurants, setRestaurants] = useState([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [state, dispatch] = useReducer(
    formReducer,
    initialRestaurantId,
    createInitialState
  );

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadRestaurants = async () => {
      setLoadingRestaurants(true);
      setLoadError('');
      try {
        const data = await fetchRestaurants(controller.signal);
        if (!isActive) return;
        const list = Array.isArray(data) ? data : data.restaurants || [];
        setRestaurants(list);
      } catch (err) {
        if (!isActive || err.name === 'AbortError') return;
        if (err.status === 401) {
          await logout();
          navigate('/login', { replace: true });
          return;
        }
        setLoadError(err.message || 'تعذّر تحميل قائمة المطاعم');
      } finally {
        if (isActive) setLoadingRestaurants(false);
      }
    };

    loadRestaurants();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [logout, navigate]);

  const validate = (values) => {
    const errors = {};
    const selectedRestaurant = restaurants.find((r) => r.id === values.restaurantId);

    if (!values.restaurantId) {
      errors.restaurantId = 'يرجى اختيار مطعم';
    } else if (selectedRestaurant && !selectedRestaurant.isOpen) {
      errors.restaurantId = 'هذا المطعم مغلق حالياً ولا يمكن إنشاء طلب منه';
    }

    const title = values.title.trim();
    if (title.length < 3 || title.length > 80) {
      errors.title = 'عنوان الطلب يجب أن يكون بين 3 و 80 حرفاً';
    }

    const pickup = values.pickupLocation.trim();
    if (pickup.length < 3 || pickup.length > 160) {
      errors.pickupLocation = 'مكان الاستلام يجب أن يكون بين 3 و 160 حرفاً';
    }

    if (values.note.trim().length > 300) {
      errors.note = 'الملاحظة يجب ألا تتجاوز 300 حرف';
    }

    const now = Date.now();
    const closesTime = values.closesAt ? new Date(values.closesAt).getTime() : NaN;
    const expectedTime = values.expectedAt ? new Date(values.expectedAt).getTime() : NaN;

    if (Number.isNaN(closesTime) || closesTime <= now) {
      errors.closesAt = 'وقت الإغلاق يجب أن يكون في المستقبل';
    }

    if (Number.isNaN(expectedTime) || (!Number.isNaN(closesTime) && expectedTime <= closesTime)) {
      errors.expectedAt = 'وقت الاستلام المتوقع يجب أن يكون بعد وقت الإغلاق';
    }

    const feeStr = String(values.deliveryFeeJod).trim();
    const feeNum = Number(feeStr);
    const decimalPart = feeStr.includes('.') ? feeStr.split('.')[1] : '';

    if (feeStr === '' || Number.isNaN(feeNum) || feeNum < 0) {
      errors.deliveryFeeJod = 'رسوم التوصيل يجب أن تكون 0 أو أكثر (لا تقبل قيمة سالبة)';
    } else if (decimalPart.length > 3) {
      errors.deliveryFeeJod = 'رسوم التوصيل تقبل حتى 3 منازل عشرية فقط';
    } else if (Math.round(feeNum * 1000) > 100000) {
      errors.deliveryFeeJod = 'رسوم التوصيل تتجاوز الحد الأقصى المسموح (100 دينار)';
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (state.submitting) return;

    const validationErrors = validate(state.values);
    if (Object.keys(validationErrors).length > 0) {
      dispatch({ type: 'SET_ERRORS', errors: validationErrors });
      return;
    }

    dispatch({ type: 'SET_SUBMITTING', value: true });

    try {
      const payload = {
        restaurantId: state.values.restaurantId,
        title: state.values.title.trim(),
        closesAt: new Date(state.values.closesAt).toISOString(),
        expectedAt: new Date(state.values.expectedAt).toISOString(),
        pickupLocation: state.values.pickupLocation.trim(),
        deliveryFeeFils: Math.round(Number(state.values.deliveryFeeJod) * 1000),
        note: state.values.note.trim(),
      };

      const created = await createGroupOrder(payload);
      const orderId = created.id || created.order?.id;
      navigate(orderId ? `/orders/${orderId}` : '/orders', { replace: true });
    } catch (err) {
      if (err.status === 401) {
        await logout();
        navigate('/login', { replace: true });
        return;
      }
      dispatch({
        type: 'SET_SERVER_ERROR',
        message: err.message || 'تعذّر إنشاء الطلب الجماعي',
      });
    }
  };

  if (loadingRestaurants) return <p>جاري تحميل قائمة المطاعم...</p>;
  if (loadError) return <p role="alert" className="alert-error">{loadError}</p>;

  const { values, errors, submitting, serverError } = state;

  return (
    <div className="admin-page">
      <h1>إنشاء طلب جماعي</h1>

      <section className="admin-card">
        {serverError && (
          <p role="alert" className="alert-error">
            {serverError}
          </p>
        )}

        <form onSubmit={handleSubmit} className="admin-form" noValidate>
          <div className="auth-field">
            <label htmlFor="order-restaurant">المطعم</label>
            <select
              id="order-restaurant"
              value={values.restaurantId}
              onChange={(e) =>
                dispatch({ type: 'SET_FIELD', field: 'restaurantId', value: e.target.value })
              }
              disabled={submitting}
            >
              <option value="">-- اختر مطعماً --</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id} disabled={!r.isOpen}>
                  {r.name} ({r.category}) {!r.isOpen ? '— مغلق' : ''}
                </option>
              ))}
            </select>
            {errors.restaurantId && <span style={{ color: 'var(--danger-text)', fontSize: '0.85rem' }}>{errors.restaurantId}</span>}
          </div>

          <div className="auth-field">
            <label htmlFor="order-title">عنوان الطلب</label>
            <input
              id="order-title"
              type="text"
              placeholder="مثال: غداء فريق التطوير"
              value={values.title}
              onChange={(e) =>
                dispatch({ type: 'SET_FIELD', field: 'title', value: e.target.value })
              }
              disabled={submitting}
            />
            {errors.title && <span style={{ color: 'var(--danger-text)', fontSize: '0.85rem' }}>{errors.title}</span>}
          </div>

          <div className="auth-field">
            <label htmlFor="order-closes">وقت الإغلاق</label>
            <input
              id="order-closes"
              type="datetime-local"
              value={values.closesAt}
              onChange={(e) =>
                dispatch({ type: 'SET_FIELD', field: 'closesAt', value: e.target.value })
              }
              disabled={submitting}
            />
            {errors.closesAt && <span style={{ color: 'var(--danger-text)', fontSize: '0.85rem' }}>{errors.closesAt}</span>}
          </div>

          <div className="auth-field">
            <label htmlFor="order-expected">وقت الاستلام المتوقع</label>
            <input
              id="order-expected"
              type="datetime-local"
              value={values.expectedAt}
              onChange={(e) =>
                dispatch({ type: 'SET_FIELD', field: 'expectedAt', value: e.target.value })
              }
              disabled={submitting}
            />
            {errors.expectedAt && <span style={{ color: 'var(--danger-text)', fontSize: '0.85rem' }}>{errors.expectedAt}</span>}
          </div>

          <div className="auth-field">
            <label htmlFor="order-pickup">مكان الاستلام</label>
            <input
              id="order-pickup"
              type="text"
              placeholder="مثال: مكتب الاستقبال - الطابق الثالث"
              value={values.pickupLocation}
              onChange={(e) =>
                dispatch({ type: 'SET_FIELD', field: 'pickupLocation', value: e.target.value })
              }
              disabled={submitting}
            />
            {errors.pickupLocation && <span style={{ color: 'var(--danger-text)', fontSize: '0.85rem' }}>{errors.pickupLocation}</span>}
          </div>

          <div className="auth-field">
            <label htmlFor="order-fee">رسوم التوصيل (بالدينار، حتى 3 منازل عشرية)</label>
            <input
              id="order-fee"
              type="number"
              min="0"
              step="0.001"
              value={values.deliveryFeeJod}
              onChange={(e) =>
                dispatch({ type: 'SET_FIELD', field: 'deliveryFeeJod', value: e.target.value })
              }
              disabled={submitting}
            />
            {errors.deliveryFeeJod && <span style={{ color: 'var(--danger-text)', fontSize: '0.85rem' }}>{errors.deliveryFeeJod}</span>}
          </div>

          <div className="auth-field">
            <label htmlFor="order-note">ملاحظة (اختياري)</label>
            <textarea
              id="order-note"
              rows={3}
              placeholder="أي ملاحظات للمشاركين..."
              value={values.note}
              onChange={(e) =>
                dispatch({ type: 'SET_FIELD', field: 'note', value: e.target.value })
              }
              disabled={submitting}
            />
            {errors.note && <span style={{ color: 'var(--danger-text)', fontSize: '0.85rem' }}>{errors.note}</span>}
          </div>

          <div className="restaurant-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? 'جاري الإنشاء...' : 'إنشاء الطلب'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => dispatch({ type: 'RESET', defaultRestaurantId: initialRestaurantId })}
              disabled={submitting}
            >
              إعادة تعيين
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}