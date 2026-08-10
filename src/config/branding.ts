// Whitelabel branding — override via .env (see .env.example) per client deployment.
// Nothing in the component tree should ever hardcode a brand name or color;
// everything reads from here.

export const branding = {
  productName: import.meta.env.VITE_BRAND_NAME || 'ReviewShake',
  logoUrl: import.meta.env.VITE_BRAND_LOGO_URL || null, // falls back to text wordmark if unset
  brandColor: import.meta.env.VITE_BRAND_COLOR || '#7C3AED',
  brandColorHover: import.meta.env.VITE_BRAND_COLOR_HOVER || '#6D28D9',
  brandColorSoft: import.meta.env.VITE_BRAND_COLOR_SOFT || '#F3EEFF',
  brandColor2: import.meta.env.VITE_BRAND_COLOR_2 || '#EC4899', // gradient partner color
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL || 'support@example.com',
};

export function applyBrandingCssVars() {
  const root = document.documentElement;
  root.style.setProperty('--brand-color', branding.brandColor);
  root.style.setProperty('--brand-color-hover', branding.brandColorHover);
  root.style.setProperty('--brand-color-soft', branding.brandColorSoft);
  root.style.setProperty('--brand-color-2', branding.brandColor2);
  document.title = branding.productName;
}
