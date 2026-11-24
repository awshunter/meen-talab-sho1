import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { startMocking } from './mocks/browser.js';
import './styles/variables.css';
import './styles/global.css';
import './styles/layout.css';

// يجب تشغيل المحاكاة قبل أول طلب API. اترك هذا الإعداد كما هو.
startMocking().then(() => {
  createRoot(document.getElementById('root')).render(
    <React.StrictMode><App /></React.StrictMode>
  );
}).catch((error) => {
  console.error('Mock API failed to start:', error);
  document.getElementById('root').textContent =
    'تعذّر تشغيل المحاكاة. افتح Console للتفاصيل. استخدم npm run dev ثم localhost.';
});
