/**
 * MCCL Error Reporter
 * Drop this into each app's main.tsx — it auto-reports client errors to the hub.
 *
 * Usage:
 *   import { initErrorReporter } from './error-reporter';
 *   initErrorReporter('McCulloch-Valuation');
 */

const HUB_URL = import.meta.env.VITE_ERROR_HUB_URL || 'https://errors.buymediamonds.co.uk';

function report(app: string, type: string, message: string, stack?: string, url?: string) {
  // Fire and forget — never block the UI
  fetch(`${HUB_URL}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app, type, message, stack, url }),
  }).catch(() => { /* silently ignore — reporter must never throw */ });
}

export function initErrorReporter(appName: string) {
  // Catch synchronous JS errors
  window.addEventListener('error', (e) => {
    if (!e.message) return;
    report(appName, 'client', e.message, e.error?.stack, window.location.href);
  });

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason instanceof Error
      ? e.reason.message
      : String(e.reason);
    report(appName, 'client', msg, e.reason?.stack, window.location.href);
  });

  console.log(`[ErrorReporter] Initialized for ${appName} → ${HUB_URL}`);
}
