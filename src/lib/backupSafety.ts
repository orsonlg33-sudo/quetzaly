/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FinanceEntry } from '../types/finance';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Unprotected entries at which the Home banner first appears. */
export const BANNER_ENTRY_THRESHOLD = 15;
/** Days since the last backup at which the banner appears, if anything changed since. */
export const BANNER_DAY_THRESHOLD = 30;

export interface BackupSafety {
  /** Timestamp of the last export, or null if the user has never exported */
  lastBackupAt: number | null;
  /** Whole days since the last export, null when there has never been one */
  daysSinceBackup: number | null;
  /** Entries created since the last export, or all of them when there has been none */
  entriesSinceBackup: number;
  /** True when there is something to lose that is not in a backup */
  isAtRisk: boolean;
  /** True when the risk is large enough to interrupt the Home screen once */
  shouldPromptOnHome: boolean;
}

/**
 * Works out how exposed the device is to losing data that was never exported.
 *
 * `dismissedAtCount` is the entry count when the user last dismissed the banner,
 * so the prompt returns only after meaningfully more has accumulated rather than
 * on the next entry.
 */
export function computeBackupSafety(params: {
  entries: FinanceEntry[];
  lastBackupAt?: number | null;
  dismissedAtCount?: number | null;
  now?: number;
}): BackupSafety {
  const { entries, lastBackupAt = null, dismissedAtCount = null, now = Date.now() } = params;

  const entriesSinceBackup =
    lastBackupAt === null
      ? entries.length
      : entries.filter((e) => (e.createdAt ?? 0) > lastBackupAt).length;

  const daysSinceBackup =
    lastBackupAt === null ? null : Math.max(0, Math.floor((now - lastBackupAt) / MS_PER_DAY));

  const isAtRisk = entriesSinceBackup > 0;

  const pastEntryThreshold = entriesSinceBackup >= BANNER_ENTRY_THRESHOLD;
  const pastDayThreshold =
    daysSinceBackup !== null && daysSinceBackup >= BANNER_DAY_THRESHOLD && entriesSinceBackup > 0;

  // After a dismissal, wait until the unprotected pile has grown by another threshold.
  const clearedDismissal =
    dismissedAtCount === null || entriesSinceBackup >= dismissedAtCount + BANNER_ENTRY_THRESHOLD;

  return {
    lastBackupAt,
    daysSinceBackup,
    entriesSinceBackup,
    isAtRisk,
    shouldPromptOnHome: (pastEntryThreshold || pastDayThreshold) && clearedDismissal,
  };
}

/**
 * Plain-language description of how long ago the last backup was.
 */
export function describeLastBackup(safety: BackupSafety): string {
  if (safety.lastBackupAt === null) return 'Never exported';
  const days = safety.daysSinceBackup ?? 0;
  if (days === 0) return 'Exported today';
  if (days === 1) return 'Exported yesterday';
  if (days < 30) return `Exported ${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'Exported a month ago' : `Exported ${months} months ago`;
}

export interface BackupContentsSummary {
  entryCount: number;
  recurringCount: number;
  categoryCount: number;
  /** Earliest and latest entry dates, YYYY-MM-DD, or null when there are no entries */
  firstDate: string | null;
  lastDate: string | null;
  /** Currencies used by the entries, most frequent first */
  currencies: string[];
  homeCurrency: string | null;
  exportedAt: string | null;
}

/**
 * Describes what a backup file actually holds, so a restore can be previewed
 * before it overwrites anything.
 */
export function summariseBackupContents(backup: unknown): BackupContentsSummary {
  const data = (backup as { data?: Record<string, unknown> } | null)?.data ?? {};
  const entries = Array.isArray(data.entries) ? (data.entries as FinanceEntry[]) : [];
  const recurring = Array.isArray(data.recurring) ? data.recurring : [];
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const settings = (data.settings ?? null) as { homeCurrency?: string } | null;

  let firstDate: string | null = null;
  let lastDate: string | null = null;
  const counts = new Map<string, number>();

  for (const entry of entries) {
    if (typeof entry?.date === 'string') {
      if (firstDate === null || entry.date < firstDate) firstDate = entry.date;
      if (lastDate === null || entry.date > lastDate) lastDate = entry.date;
    }
    if (typeof entry?.currency === 'string' && entry.currency) {
      const code = entry.currency.toUpperCase();
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }

  const currencies = [...counts.entries()]
    .sort((a, b) => (b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1]))
    .map(([code]) => code);

  return {
    entryCount: entries.length,
    recurringCount: recurring.length,
    categoryCount: categories.length,
    firstDate,
    lastDate,
    currencies,
    homeCurrency: settings?.homeCurrency ? settings.homeCurrency.toUpperCase() : null,
    exportedAt:
      typeof (backup as { exportedAt?: unknown })?.exportedAt === 'string'
        ? ((backup as { exportedAt: string }).exportedAt)
        : null,
  };
}
