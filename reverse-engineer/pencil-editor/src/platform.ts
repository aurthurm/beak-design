export const isHeadlessMode =
  typeof window === "undefined" || typeof document === "undefined";

export const getDPI = isHeadlessMode
  ? () => 1
  : () => {
      return window.devicePixelRatio;
    };

export const appName = isHeadlessMode ? "" : (window as any).PENCIL_APP_NAME;
