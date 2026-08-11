import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyBrandingCssVars } from './config/branding';
import { ToastProvider } from './lib/toast';
import { authApi } from './lib/api';
import './styles/index.css';

applyBrandingCssVars();

// Public demo build: nobody sharing this link should have to sign up or log
// in first. If there's no session yet, silently sign the visitor into the
// seeded demo business so the dashboard is the very first thing they see.
// (Explicit /login and /signup still work as before for anyone who wants
// to try that flow, or to reach /admin.)
if (!authApi.isLoggedIn()) {
  authApi.setToken('demo-token:1');
}

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
