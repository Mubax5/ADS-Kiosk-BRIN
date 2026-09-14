/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KIOSK_DEVICE_TOKEN?: string;
  readonly VITE_KIOSK_SOFTWARE_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
