let errorReportCallback: ((error: unknown) => void) | null = null;

export function setErrorReportCallback(
  callback: (error: unknown) => void,
): void {
  errorReportCallback = callback;
}

export function reportError(error: unknown): void {
  if (errorReportCallback) {
    errorReportCallback(error);
  }
}
