import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../services/authService';

export default function RegisterPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // مسح خطأ الحقل بمجرد ما المستخدم يعدّل عليه
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (generalError) setGeneralError('');
  };

  const validateLocally = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'الاسم مطلوب';
    }

    if (!formData.email.trim()) {
      errors.email = 'البريد الإلكتروني مطلوب';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'صيغة البريد الإلكتروني غير صحيحة';
    }

    if (!formData.password) {
      errors.password = 'كلمة المرور مطلوبة';
    } else if (formData.password.length < 8) {
      errors.password = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
    }

    if (formData.confirmPassword !== formData.password) {
      errors.confirmPassword = 'تأكيد كلمة المرور غير مطابق';
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // منع الإرسال المتكرر

    const localErrors = validateLocally();
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      return;
    }

    setLoading(true);
    setFieldErrors({});
    setGeneralError('');

    try {
      // نرسل الاسم، البريد، وكلمة المرور فقط (بدون confirmPassword)
      await registerUser({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });

      // الانتقال لصفحة تسجيل الدخول مع رسالة نجاح
      navigate('/login', {
        state: { successMessage: 'تم إنشاء الحساب بنجاح، يمكنك تسجيل الدخول الآن.' },
      });
    } catch (err) {
      // عرض أخطاء الـ API بجانب الحقول إن توفرت، بدون مسح formData
      if (err.fields) {
        setFieldErrors(err.fields);
      }
      setGeneralError(err.message || 'فشل إنشاء الحساب، حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>إنشاء حساب جديد</h1>

      {generalError && <p role="alert">{generalError}</p>}

      <form onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="name">الاسم</label>
          <input
            id="name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            disabled={loading}
          />
          {fieldErrors.name && <span>{fieldErrors.name}</span>}
        </div>

        <div>
          <label htmlFor="email">البريد الإلكتروني</label>
          <input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            disabled={loading}
          />
          {fieldErrors.email && <span>{fieldErrors.email}</span>}
        </div>

        <div>
          <label htmlFor="password">كلمة المرور</label>
          <input
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            disabled={loading}
          />
          {fieldErrors.password && <span>{fieldErrors.password}</span>}
        </div>

        <div>
          <label htmlFor="confirmPassword">تأكيد كلمة المرور</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            disabled={loading}
          />
          {fieldErrors.confirmPassword && <span>{fieldErrors.confirmPassword}</span>}
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب'}
        </button>
      </form>

      <p>
        لديك حساب بالفعل؟ <Link to="/login">تسجيل الدخول</Link>
      </p>
    </div>
  );
}