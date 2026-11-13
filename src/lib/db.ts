/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Category, FinanceEntry, UserSettings, BudgetLimit, RecurringRule, RecurringOccurrence } from '../types/finance';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from './defaults';

const DB_NAME = 'kumo_finance_db';
const DB_VERSION = 3;

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Initializes and opens the versioned IndexedDB instance.
 * Supports future upgrades for subsequent phases (limits, recurring, etc.).
 */
export async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      // Version 1 stores
      if (oldVersion < 1) {
        // Entries store
        const entryStore = db.createObjectStore('entries', { keyPath: 'id' });
        entryStore.createIndex('date', 'date', { unique: false });
        entryStore.createIndex('type', 'type', { unique: false });
        entryStore.createIndex('categoryId', 'categoryId', { unique: false });
        entryStore.createIndex('isSample', 'isSample', { unique: false });

        // Categories store
        const catStore = db.createObjectStore('categories', { keyPath: 'id' });
        catStore.createIndex('type', 'type', { unique: false });
        catStore.createIndex('isArchived', 'isArchived', { unique: false });

        // Settings store
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      // Version 2: Budget Limits Store (Phase 2)
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('limits')) {
          const limitStore = db.createObjectStore('limits', { keyPath: 'id' });
          limitStore.createIndex('type', 'type', { unique: false });
          limitStore.createIndex('categoryId', 'categoryId', { unique: false });
          limitStore.createIndex('periodId', 'periodId', { unique: false });
        }
      }

      // Version 3: Recurring rules and occurrences store (Phase 3)
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('recurring')) {
          const recStore = db.createObjectStore('recurring', { keyPath: 'id' });
          recStore.createIndex('active', 'active', { unique: false });
          recStore.createIndex('type', 'type', { unique: false });
          recStore.createIndex('frequency', 'frequency', { unique: false });
        }
        if (!db.objectStoreNames.contains('recurring_occurrences')) {
          const occStore = db.createObjectStore('recurring_occurrences', { keyPath: 'id' });
          occStore.createIndex('ruleId', 'ruleId', { unique: false });
          occStore.createIndex('date', 'date', { unique: false });
        }
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      // Request persistent storage on success
      requestPersistentStorage().catch(() => {});
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });

  return dbPromise;
}

/**
 * Requests persistent storage with navigator.storage.persist()
 */
export function requestPersistentStorage(): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator?.storage?.persist) {
    return Promise.resolve(false);
  }
  let isInIframe = true;
  try {
    isInIframe = window.self !== window.top;
  } catch {
    isInIframe = true;
  }
  if (isInIframe) {
    return Promise.resolve(false);
  }

  return navigator.storage.persist().catch(() => false);
}

/* -------------------- Entries -------------------- */

export async function getAllEntries(): Promise<FinanceEntry[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('entries', 'readonly');
    const store = tx.objectStore('entries');
    const request = store.getAll();

    request.onsuccess = () => {
      const result: FinanceEntry[] = request.result || [];
      // Sort newest date first, then by createdAt
      result.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      resolve(result);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function addEntry(entry: FinanceEntry): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('entries', 'readwrite');
    const store = tx.objectStore('entries');
    const request = store.add(entry);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function bulkAddEntries(entries: FinanceEntry[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('entries', 'readwrite');
    const store = tx.objectStore('entries');

    for (const entry of entries) {
      store.put(entry);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateEntry(entry: FinanceEntry): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('entries', 'readwrite');
    const store = tx.objectStore('entries');
    const request = store.put(entry);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('entries', 'readwrite');
    const store = tx.objectStore('entries');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Removes only sample test entries without modifying real user entries
 */
export async function clearSampleEntries(): Promise<number> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('entries', 'readwrite');
    const store = tx.objectStore('entries');
    const request = store.openCursor();
    let count = 0;

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const item = cursor.value as FinanceEntry;
        if (item.isSample) {
          cursor.delete();
          count++;
        }
        cursor.continue();
      } else {
        resolve(count);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

/* -------------------- Categories -------------------- */

export async function getAllCategories(): Promise<Category[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('categories', 'readonly');
    const store = tx.objectStore('categories');
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function initDefaultCategoriesIfNeeded(): Promise<Category[]> {
  const existing = await getAllCategories();
  if (existing.length === 0) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('categories', 'readwrite');
      const store = tx.objectStore('categories');

      for (const cat of DEFAULT_CATEGORIES) {
        store.add(cat);
      }

      tx.oncomplete = () => resolve(DEFAULT_CATEGORIES);
      tx.onerror = () => reject(tx.error);
    });
  }

  // Migrate any existing purple, violet, navy, or non-warm colors in IndexedDB
  const WARM_MAP: Record<string, string> = {
    '#9B5DE5': '#FFB020', // Entertainment purple -> Amber
    '#8338EC': '#FFB020',
    '#6366F1': '#C9A86A', // Indigo -> Sand amber
    '#A855F7': '#FFB020',
    '#457B9D': '#7FA8A0', // Steel/slate blue -> Warm sage
    '#2B2D42': '#A8A29E', // Charcoal navy -> Warm stone
    '#E07A5F': '#E8761A', // Terracotta -> Ember
    '#D4A373': '#C9A86A',
    '#2A9D8F': '#4FD1A1',
    '#E76F51': '#D9826B',
    '#6C757D': '#A8A29E',
    '#3D7B5E': '#8FA67A',
    '#BC6C25': '#E8761A',
    '#F4A261': '#FFB020',
  };

  let needsSave = false;
  const migrated = existing.map((cat) => {
    const upperCol = (cat.color || '').toUpperCase();
    if (WARM_MAP[upperCol]) {
      needsSave = true;
      return { ...cat, color: WARM_MAP[upperCol] };
    }
    return cat;
  });

  if (needsSave) {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('categories', 'readwrite');
      const store = tx.objectStore('categories');
      for (const cat of migrated) {
        store.put(cat);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  return migrated;
}

export async function saveCategory(category: Category): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('categories', 'readwrite');
    const store = tx.objectStore('categories');
    const request = store.put(category);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function archiveCategory(id: string): Promise<void> {
  const categories = await getAllCategories();
  const target = categories.find((c) => c.id === id);
  if (!target) return;
  target.isArchived = true;
  await saveCategory(target);
}

export async function unarchiveCategory(id: string): Promise<void> {
  const categories = await getAllCategories();
  const target = categories.find((c) => c.id === id);
  if (!target) return;
  target.isArchived = false;
  await saveCategory(target);
}

/**
 * If a category has entries, archive it so old entries keep their emoji & color.
 * If a category has no entries, delete it permanently from the store.
 */
export async function deleteOrArchiveCategory(id: string): Promise<{ archived: boolean; entryCount: number }> {
  const allEntries = await getAllEntries();
  const count = allEntries.filter((e) => e.categoryId === id).length;

  if (count > 0) {
    await archiveCategory(id);
    return { archived: true, entryCount: count };
  } else {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('categories', 'readwrite');
      const store = tx.objectStore('categories');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    return { archived: false, entryCount: 0 };
  }
}

/* -------------------- Limits -------------------- */

export async function getAllLimits(): Promise<BudgetLimit[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('limits', 'readonly');
    const store = tx.objectStore('limits');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLimit(limit: BudgetLimit): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('limits', 'readwrite');
    const store = tx.objectStore('limits');
    const request = store.put(limit);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteLimit(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('limits', 'readwrite');
    const store = tx.objectStore('limits');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/* -------------------- Recurring Rules -------------------- */

export async function getAllRecurringRules(): Promise<RecurringRule[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recurring', 'readonly');
    const store = tx.objectStore('recurring');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function saveRecurringRule(rule: RecurringRule): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recurring', 'readwrite');
    const store = tx.objectStore('recurring');
    const request = store.put(rule);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteRecurringRule(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recurring', 'readwrite');
    const store = tx.objectStore('recurring');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/* -------------------- Recurring Occurrences (Idempotency Tracking) -------------------- */

export async function getAllRecurringOccurrences(): Promise<RecurringOccurrence[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recurring_occurrences', 'readonly');
    const store = tx.objectStore('recurring_occurrences');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getRecurringOccurrencesMap(): Promise<Map<string, RecurringOccurrence>> {
  const occs = await getAllRecurringOccurrences();
  const map = new Map<string, RecurringOccurrence>();
  for (const occ of occs) {
    map.set(occ.id, occ);
  }
  return map;
}

export async function saveRecurringOccurrence(occ: RecurringOccurrence): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recurring_occurrences', 'readwrite');
    const store = tx.objectStore('recurring_occurrences');
    const request = store.put(occ);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function bulkSaveRecurringOccurrences(occs: RecurringOccurrence[]): Promise<void> {
  if (occs.length === 0) return;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recurring_occurrences', 'readwrite');
    const store = tx.objectStore('recurring_occurrences');

    for (const occ of occs) {
      store.put(occ);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* -------------------- Settings -------------------- */

export async function getStoredSettings(): Promise<UserSettings> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const request = store.get('user_settings');

    request.onsuccess = () => {
      if (request.result && request.result.value) {
        resolve({
          ...DEFAULT_SETTINGS,
          ...request.result.value,
        });
      } else {
        resolve(DEFAULT_SETTINGS);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveStoredSettings(updates: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getStoredSettings();
  const next: UserSettings = { ...current, ...updates };

  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const request = store.put({ key: 'user_settings', value: next });

    request.onsuccess = () => resolve(next);
    request.onerror = () => reject(request.error);
  });
}

/* -------------------- Currency Migrations & Conversions -------------------- */

/**
 * Migrates existing entries on app launch:
 * 1. Ensures sample entries and entries in home currency have rate 1.0, homeAmount = amount, rateStatus 'fetched'.
 * 2. Pre-existing foreign entries without valid rates are converted or marked pending.
 */
export async function migrateExistingEntries(homeCurrency: string): Promise<FinanceEntry[]> {
  const entries = await getAllEntries();
  let hasModifications = false;
  const updatedEntries: FinanceEntry[] = [];

  for (const entry of entries) {
    let item = { ...entry };
    let itemModified = false;

    // 1. Entries in home currency
    if (item.currency.toUpperCase() === homeCurrency.toUpperCase()) {
      if (
        item.rate !== 1.0 ||
        item.homeAmount !== item.amount ||
        item.rateStatus !== 'fetched'
      ) {
        item.rate = 1.0;
        item.homeAmount = item.amount;
        item.rateStatus = 'fetched';
        item.rateEditedManually = false;
        itemModified = true;
      }
    } else {
      // Foreign currency entry without a rate or unconverted
      if (!item.rate || item.rate <= 0 || !item.rateStatus) {
        item.rate = 1.0;
        item.homeAmount = item.amount;
        item.rateStatus = 'pending';
        item.rateEditedManually = false;
        itemModified = true;
      }
    }

    if (itemModified) {
      hasModifications = true;
      await updateEntry(item);
    }
    updatedEntries.push(item);
  }

  return hasModifications ? await getAllEntries() : entries;
}

/**
 * Converts all pending or estimated entries when online.
 * Skips entries where rateEditedManually is true.
 */
export async function refreshPendingRates(
  homeCurrency: string,
  getRateFn: (from: string, to: string, date?: string) => Promise<{ rate: number; rateStatus: any }>
): Promise<{ updated: FinanceEntry[]; convertedCount: number }> {
  const entries = await getAllEntries();
  const candidates = entries.filter(
    (e) =>
      !e.rateEditedManually &&
      e.currency.toUpperCase() !== homeCurrency.toUpperCase() &&
      (e.rateStatus === 'pending' || e.rateStatus === 'estimated')
  );

  if (candidates.length === 0) {
    return { updated: entries, convertedCount: 0 };
  }

  let convertedCount = 0;
  for (const item of candidates) {
    try {
      const res = await getRateFn(item.currency, homeCurrency, item.date);
      if (res.rate > 0) {
        item.rate = res.rate;
        item.homeAmount = Math.round(item.amount * res.rate);
        item.rateStatus = res.rateStatus;
        await updateEntry(item);
        convertedCount++;
      }
    } catch {
      // Ignore network failures for individual entries
    }
  }

  const refreshed = await getAllEntries();
  return { updated: refreshed, convertedCount };
}

/**
 * Recomputes homeAmount for all entries when the user confirms changing homeCurrency in Settings.
 * Preserves original amounts and currencies.
 */
export async function recomputeAllEntriesForNewHomeCurrency(
  newHomeCurrency: string,
  getRateFn: (from: string, to: string, date?: string) => Promise<{ rate: number; rateStatus: any }>
): Promise<FinanceEntry[]> {
  const entries = await getAllEntries();

  for (const entry of entries) {
    const item = { ...entry };
    if (item.currency.toUpperCase() === newHomeCurrency.toUpperCase()) {
      item.rate = 1.0;
      item.homeAmount = item.amount;
      item.rateStatus = 'fetched';
      item.rateEditedManually = false;
    } else {
      // Query exchange rate to new home currency
      try {
        const res = await getRateFn(item.currency, newHomeCurrency, item.date);
        if (res.rate > 0) {
          item.rate = res.rate;
          item.homeAmount = Math.round(item.amount * res.rate);
          item.rateStatus = res.rateStatus;
        } else {
          item.rate = 0;
          item.homeAmount = 0;
          item.rateStatus = 'pending';
        }
      } catch {
        item.rate = 0;
        item.homeAmount = 0;
        item.rateStatus = 'pending';
      }
    }
    await updateEntry(item);
  }

  return await getAllEntries();
}

/**
 * Exports full database backup JSON object
 */
export async function exportDatabase(includePhotos: boolean): Promise<{
  backup: any;
  estimatedSizeKb: number;
}> {
  const [entries, categories, limits, settings, recurring, recurringOccurrences] = await Promise.all([
    getAllEntries(),
    getAllCategories(),
    getAllLimits(),
    getStoredSettings(),
    getAllRecurringRules(),
    getAllRecurringOccurrences(),
  ]);

  const processedEntries = entries.map((e) => {
    const entry = { ...e };
    if (!includePhotos) {
      delete entry.photoUrl;
    }
    return entry;
  });

  const backup = {
    appId: 'quetzaly',
    schemaVersion: DB_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      entries: processedEntries,
      categories,
      limits,
      settings,
      recurring,
      recurringOccurrences,
    },
  };

  const estimatedSizeKb = Math.max(1, Math.round(JSON.stringify(backup).length / 1024));

  return { backup, estimatedSizeKb };
}

/**
 * Validates a backup object against Quetzaly schema requirements
 */
export function validateBackup(backupObj: any): {
  valid: boolean;
  error?: string;
  summary?: {
    entryCount: number;
    categoryCount: number;
    limitCount: number;
    recurringCount: number;
    exportedAt: string;
  };
} {
  if (!backupObj || typeof backupObj !== 'object') {
    return {
      valid: false,
      error: "This file isn't a valid backup. Choose a file exported from Quetzaly.",
    };
  }
  if (backupObj.appId !== 'quetzaly') {
    return {
      valid: false,
      error: "This file wasn't exported from Quetzaly.",
    };
  }
  if (typeof backupObj.schemaVersion !== 'number' || backupObj.schemaVersion > DB_VERSION) {
    return {
      valid: false,
      error: "This backup comes from a newer version of Quetzaly. Update the app and try again.",
    };
  }
  if (!backupObj.data || typeof backupObj.data !== 'object') {
    return {
      valid: false,
      error: "This file isn't a valid backup. Choose a file exported from Quetzaly.",
    };
  }

  const entries = Array.isArray(backupObj.data.entries) ? backupObj.data.entries : [];
  const categories = Array.isArray(backupObj.data.categories) ? backupObj.data.categories : [];
  const limits = Array.isArray(backupObj.data.limits) ? backupObj.data.limits : [];
  const recurring = Array.isArray(backupObj.data.recurring) ? backupObj.data.recurring : [];

  return {
    valid: true,
    summary: {
      entryCount: entries.length,
      categoryCount: categories.length,
      limitCount: limits.length,
      recurringCount: recurring.length,
      exportedAt: backupObj.exportedAt || new Date().toISOString(),
    },
  };
}

/**
 * Imports full database backup JSON object in a single transaction (replace or merge)
 */
export async function importDatabase(backupObj: any, mode: 'replace' | 'merge'): Promise<number> {
  const validation = validateBackup(backupObj);
  if (!validation.valid) {
    throw new Error(validation.error || "The import didn't finish and nothing was changed.");
  }

  const db = await getDB();
  const {
    entries = [],
    categories = [],
    limits = [],
    settings,
    recurring = [],
    recurringOccurrences = [],
  } = backupObj.data || {};

  if (mode === 'merge') {
    const currentSettings = await getStoredSettings();
    const backupCurrency = (settings?.homeCurrency || '').toUpperCase();
    const currentCurrency = (currentSettings.homeCurrency || '').toUpperCase();
    if (backupCurrency && currentCurrency && backupCurrency !== currentCurrency) {
      throw new Error(`This backup uses ${backupCurrency} as its home currency. This device uses ${currentCurrency}.`);
    }
  }

  return new Promise((resolve, reject) => {
    let failureHandled = false;
    const handleError = () => {
      if (!failureHandled) {
        failureHandled = true;
        reject(new Error("The import didn't finish and nothing was changed."));
      }
    };

    const tx = db.transaction(
      ['entries', 'categories', 'limits', 'settings', 'recurring', 'recurring_occurrences'],
      'readwrite'
    );
    const entryStore = tx.objectStore('entries');
    const catStore = tx.objectStore('categories');
    const limitStore = tx.objectStore('limits');
    const settingsStore = tx.objectStore('settings');
    const recStore = tx.objectStore('recurring');
    const occStore = tx.objectStore('recurring_occurrences');

    tx.onerror = handleError;
    tx.onabort = handleError;

    let importedCount = 0;

    if (mode === 'replace') {
      entryStore.clear();
      catStore.clear();
      limitStore.clear();
      settingsStore.clear();
      recStore.clear();
      occStore.clear();

      for (const cat of categories) {
        catStore.put(cat);
      }

      for (const limit of limits) {
        limitStore.put(limit);
      }

      if (settings) {
        settingsStore.put({ key: 'user_settings', value: settings });
      }

      for (const rec of recurring) {
        recStore.put(rec);
      }

      for (const occ of recurringOccurrences) {
        occStore.put(occ);
      }

      for (const entry of entries) {
        entryStore.put(entry);
        importedCount++;
      }

      tx.oncomplete = () => resolve(importedCount);
    } else {
      // Merge mode:
      // 1. Categories
      const catReq = catStore.getAllKeys();
      catReq.onsuccess = () => {
        const existingCatKeys = new Set(catReq.result as string[]);
        for (const cat of categories) {
          if (!existingCatKeys.has(cat.id)) {
            catStore.put(cat);
          }
        }
      };
      catReq.onerror = handleError;

      // 2. Limits
      const limitReq = limitStore.getAllKeys();
      limitReq.onsuccess = () => {
        const existingLimitKeys = new Set(limitReq.result as string[]);
        for (const limit of limits) {
          if (!existingLimitKeys.has(limit.id)) {
            limitStore.put(limit);
          }
        }
      };
      limitReq.onerror = handleError;

      // 3. Recurring rules: "Merge skips rules whose id already exists."
      const recReq = recStore.getAllKeys();
      recReq.onsuccess = () => {
        const existingRecKeys = new Set(recReq.result as string[]);
        for (const rec of recurring) {
          if (!existingRecKeys.has(rec.id)) {
            recStore.put(rec);
          }
        }
      };
      recReq.onerror = handleError;

      // 4. Recurring occurrences
      const occReq = occStore.getAllKeys();
      occReq.onsuccess = () => {
        const existingOccKeys = new Set(occReq.result as string[]);
        for (const occ of recurringOccurrences) {
          if (!existingOccKeys.has(occ.id)) {
            occStore.put(occ);
          }
        }
      };
      occReq.onerror = handleError;

      // 5. Entries (add if not present)
      const entryReq = entryStore.getAllKeys();
      entryReq.onsuccess = () => {
        const existingEntryKeys = new Set(entryReq.result as string[]);
        for (const entry of entries) {
          if (!existingEntryKeys.has(entry.id)) {
            entryStore.put(entry);
            importedCount++;
          }
        }
      };
      entryReq.onerror = handleError;

      tx.oncomplete = () => resolve(importedCount);
    }
  });
}



