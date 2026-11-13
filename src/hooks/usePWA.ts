/**
 * React hook for PWA Install Affordance and Service Worker Update State
 */

import { useState, useEffect } from 'react';
import {
  BeforeInstallPromptEvent,
  isStandalone,
  isIOS,
  promptInstall,
  subscribeInstallPrompt,
  subscribeUpdateAvailable,
  applySWUpdate,
} from '../lib/pwa';

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [standalone, setStandalone] = useState<boolean>(false);
  const [ios, setIos] = useState<boolean>(false);

  useEffect(() => {
    setStandalone(isStandalone());
    setIos(isIOS());

    const unsubInstall = subscribeInstallPrompt((p) => setInstallPrompt(p));
    const unsubUpdate = subscribeUpdateAvailable((u) => setUpdateAvailable(u));

    return () => {
      unsubInstall();
      unsubUpdate();
    };
  }, []);

  return {
    isInstallable: Boolean(installPrompt),
    isInstalled: standalone,
    isIOS: ios,
    updateAvailable,
    installApp: promptInstall,
    reloadApp: applySWUpdate,
  };
}
