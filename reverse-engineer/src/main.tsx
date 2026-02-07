import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { DEV_ENV, PACKAGE_VERSION, SENTRY_DSN } from "./lib/environment";
import "./globals.css";
import "./index.css";

Sentry.init({
  dsn: SENTRY_DSN,

  // Include the package version as the release version
  release: PACKAGE_VERSION,

  // Intentionally sending PIIs like IP addresses, user IDs for now.
  sendDefaultPii: true,

  // Disable Sentry in development environment
  enabled: !DEV_ENV,
});

const container = document.getElementById("root") as HTMLElement;

const root = createRoot(container, {
  onUncaughtError: Sentry.reactErrorHandler((error, errorInfo) => {
    console.warn("Uncaught error", error, errorInfo.componentStack);
  }),
  // Callback called when React catches an error in an ErrorBoundary.
  onCaughtError: Sentry.reactErrorHandler(),
  // Callback called when React automatically recovers from errors.
  onRecoverableError: Sentry.reactErrorHandler(),
});

root.render(<App />);
