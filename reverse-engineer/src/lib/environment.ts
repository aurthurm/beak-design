export const DEV_ENV = import.meta.env.DEV;
export const SKIP_LICENSE = import.meta.env.VITE_SKIP_LICENSE === "true";
export const PACKAGE_VERSION = import.meta.env.PACKAGE_VERSION || "development";
export const BACKEND_HOSTNAME =
  import.meta.env.VITE_BACKEND_HOSTNAME || "http://api.localhost:3001";
export const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
export const POSTHOG_HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;
export const SENTRY_DSN =
  import.meta.env.VITE_PUBLIC_SENTRY_DSN ||
  "https://908a8bdbc113924254b644219323ea6f@o4510271844122624.ingest.us.sentry.io/4510271928598528";
export const REVE_API_URL = import.meta.env.VITE_PUBLIC_REVE_API_URL;
export const REVE_API_KEY = import.meta.env.VITE_PUBLIC_REVE_API_KEY;
