/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE?: string;
  readonly VITE_GOOGLE_SHEETS_ID?: string;
  readonly VITE_MAKE_WEBHOOK_URL?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_DEFAULT_INDUSTRIES?: string;
}
