import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyBrandingCssVars } from './config/branding';
import { ToastProvider } from './lib/toast';
import './styles/index.css';

applyBrandingCssVars();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Notifications fall back to the page Notification API.
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);
