/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Quetzaly keeps everything on the device, which means the browser is free to
 * evict it: under storage pressure, or on iOS Safari after a stretch of non-use
 * when the app has not been installed to the home screen.
 *
 * `requestPersistentStorage` in db.ts already asks once when the database opens.
 * Browsers weigh that request against signals of engagement, so a first visit is
 * usually declined and never asked again. This module reads the resulting state
 * so it can be shown and retried once the user has data worth keeping.
 */

export interface PersistenceState {
  supported: boolean;
  persisted: boolean;
}

export async function getPersistenceState(): Promise<PersistenceState> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) {
    return { supported: false, persisted: false };
  }
  try {
    return { supported: true, persisted: await navigator.storage.persisted() };
  } catch {
    return { supported: true, persisted: false };
  }
}
