import React from 'react';
import { useLocation } from 'react-router-dom';

export default function LoginPage() {
  const location = useLocation();
  const successMessage = location.state?.successMessage;

  return (
    <div>
      <h1>تسجيل الدخول</h1>
      {successMessage && <p>{successMessage}</p>}
    </div>
  );
}