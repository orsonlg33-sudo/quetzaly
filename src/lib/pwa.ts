/**
 * Quetzaly PWA Integration Library
 * Service Worker Registration, Update Toast State, and Install Affordance Logic.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function isIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandaloneMode =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return isStandaloneMode;
}

export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isIOSDevice = /iphone|ipad|ipod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
  return isIOSDevice;
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let installPromptListeners: Array<(prompt: BeforeInstallPromptEvent | null) => void> = [];

let registrationWaitingSW: ServiceWorker | null = null;
let updateAvailableListeners: Array<(available: boolean) => void> = [];

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e as BeforeInstallPromptEvent;
    installPromptListeners.forEach((fn) => fn(deferredInstallPrompt));
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installPromptListeners.forEach((fn) => fn(null));
  });
}

/**
 * Register Service Worker ONLY in production builds AND NOT inside an iframe (Requirement 4)
 */
export function registerServiceWorker(
  onUpdateAvailable?: () => void
): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // Requirement 4: Register only in production and when NOT running inside iframe
  const isProd = import.meta.env.PROD === true;
  if (!isProd || isIframe()) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Handle update found
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.onstatechange = () => {
            if (
              installingWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              registrationWaitingSW = installingWorker;
              updateAvailableListeners.forEach((fn) => fn(true));
              if (onUpdateAvailable) {
                onUpdateAvailable();
              }
            }
          };
        };

        // If a worker is already waiting
        if (registration.waiting) {
          registrationWaitingSW = registration.waiting;
          updateAvailableListeners.forEach((fn) => fn(true));
          if (onUpdateAvailable) {
            onUpdateAvailable();
          }
        }
      })
      .catch(() => {
        // Ignore SW registration errors silently
      });
  });
}

/**
 * Trigger reload when user clicks "Reload" on update toast (Requirement 5)
 */
export function applySWUpdate(): void {
  if (registrationWaitingSW) {
    registrationWaitingSW.postMessage({ type: 'SKIP_WAITING' });
  }
  window.location.reload();
}

/**
 * Trigger install prompt
 */
export async function promptInstall(): Promise<boolean> {
  if (!deferredInstallPrompt) return false;
  try {
    await deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      deferredInstallPrompt = null;
      installPromptListeners.forEach((fn) => fn(null));
      return true;
    }
  } catch {
    // Ignore prompt errors
  }
  return false;
}

export function subscribeInstallPrompt(
  fn: (prompt: BeforeInstallPromptEvent | null) => void
): () => void {
  installPromptListeners.push(fn);
  fn(deferredInstallPrompt);
  return () => {
    installPromptListeners = installPromptListeners.filter((cb) => cb !== fn);
  };
}

export function subscribeUpdateAvailable(
  fn: (available: boolean) => void
): () => void {
  updateAvailableListeners.push(fn);
  fn(registrationWaitingSW !== null);
  return () => {
    updateAvailableListeners = updateAvailableListeners.filter((cb) => cb !== fn);
  };
}
