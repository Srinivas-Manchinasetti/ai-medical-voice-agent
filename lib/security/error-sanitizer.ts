/**
 * Production Error Sanitization Utility
 * 
 * Prevents internal infrastructure details, hostnames, stack traces,
 * file paths, and upstream library exceptions from leaking to clients in HTTP error responses.
 * 
 * Invariants:
 * 1. In production (NODE_ENV === 'production'), returns safe, generic clinical-system error messages.
 * 2. In development and test runner (NODE_ENV !== 'production'), includes diagnostic messages to assist debugging.
 * 3. Detailed diagnostic stack traces are always logged to server-side telemetry/console.
 */

export function sanitizeErrorMessage(err: unknown, fallbackMessage: string): string {
  if (err) {
    // Always preserve full diagnostics on the server side
    console.error("[ServerErrorDiagnostics]", err);
  }

  if (process.env.NODE_ENV === "production") {
    return fallbackMessage;
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  if (typeof err === "string" && err.trim().length > 0) {
    return err;
  }

  return fallbackMessage;
}

export function sanitizeErrorDetails(details: unknown): unknown | undefined {
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }
  return details;
}
