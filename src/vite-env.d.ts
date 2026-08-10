/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_BRAND_NAME: string;
  readonly VITE_BRAND_LOGO_URL: string;
  readonly VITE_BRAND_COLOR: string;
  readonly VITE_BRAND_COLOR_HOVER: string;
  readonly VITE_BRAND_COLOR_SOFT: string;
  readonly VITE_SUPPORT_EMAIL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
