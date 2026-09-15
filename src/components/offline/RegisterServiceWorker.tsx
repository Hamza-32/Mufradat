'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker explicitly rather than relying on the bundler
 * plugin to inject it. Explicit registration is one line, it is visible in the
 * page source, and it is testable — which the injected version was not.
 *
 * Registration waits for `load` so it never competes with the first review
 * screen for bandwidth on a slow connection.
 */
export function RegisterServiceWorker(): null {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = (): void => {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error: unknown) => {
        // A failed registration costs the learner offline support, not the app.
        console.warn('service worker registration failed', error);
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => {
      window.removeEventListener('load', register);
    };
  }, []);

  return null;
}
