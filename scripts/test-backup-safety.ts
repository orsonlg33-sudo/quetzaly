/**
 * Backup-safety tests for Quetzaly.
 * Covers: counting unprotected entries, the never-exported case, the Home prompt
 * thresholds and the dismissal rule, and the restore preview summary.
 */
import assert from 'node:assert/strict';
import {
  BANNER_ENTRY_THRESHOLD,
  computeBackupSafety,
  describeLastBackup,
  summariseBackupContents,
} from '../src/lib/backupSafety';
import { FinanceEntry } from '../src/types/finance';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-21T12:00:00Z').getTime();

function entry(id: string, createdAt: number, over: Partial<FinanceEntry> = {}): FinanceEntry {
  return {
    id, type: 'expense', amount: 1000, currency: 'USD', homeAmount: 1000, rate: 1,
    rateStatus: 'fetched', rateEditedManually: false, date: '2026-11-10',
    categoryId: 'cat_food', createdAt, updatedAt: createdAt, ...over,
  } as FinanceEntry;
}

function many(n: number, createdAt: number): FinanceEntry[] {
  return Array.from({ length: n }, (_, i) => entry(`e${i}`, createdAt));
}

// 1. With no backup ever taken, every entry is unprotected.
{
  const s = computeBackupSafety({ entries: many(4, NOW - DAY), now: NOW });
  assert.equal(s.entriesSinceBackup, 4);
  assert.equal(s.lastBackupAt, null);
  assert.equal(s.daysSinceBackup, null);
  assert.equal(s.isAtRisk, true);
  assert.equal(describeLastBackup(s), 'Never exported');
}

// 2. Only entries created after the backup count as unprotected.
{
  const backupAt = NOW - 3 * DAY;
  const entries = [
    entry('old1', backupAt - DAY),
    entry('old2', backupAt - 60_000),
    entry('new1', backupAt + 60_000),
  ];
  const s = computeBackupSafety({ entries, lastBackupAt: backupAt, now: NOW });
  assert.equal(s.entriesSinceBackup, 1);
  assert.equal(s.daysSinceBackup, 3);
  assert.equal(describeLastBackup(s), 'Exported 3 days ago');
}

// 3. A fresh backup leaves nothing at risk and nothing to prompt about.
{
  const s = computeBackupSafety({ entries: many(40, NOW - DAY), lastBackupAt: NOW, now: NOW });
  assert.equal(s.entriesSinceBackup, 0);
  assert.equal(s.isAtRisk, false);
  assert.equal(s.shouldPromptOnHome, false);
  assert.equal(describeLastBackup(s), 'Exported today');
}

// 4. The Home prompt waits for the threshold rather than firing on entry one.
{
  const few = computeBackupSafety({ entries: many(BANNER_ENTRY_THRESHOLD - 1, NOW), now: NOW });
  assert.equal(few.isAtRisk, true, 'still at risk');
  assert.equal(few.shouldPromptOnHome, false, 'but not worth interrupting for');

  const enough = computeBackupSafety({ entries: many(BANNER_ENTRY_THRESHOLD, NOW), now: NOW });
  assert.equal(enough.shouldPromptOnHome, true);
}

// 5. An old backup with changes since prompts even below the entry threshold.
{
  const s = computeBackupSafety({
    entries: [entry('e1', NOW - DAY)], lastBackupAt: NOW - 45 * DAY, now: NOW,
  });
  assert.equal(s.entriesSinceBackup, 1);
  assert.equal(s.shouldPromptOnHome, true, '45 days and unsaved changes is worth one nudge');
}

// 6. An old backup with nothing added since does not prompt.
{
  const backupAt = NOW - 90 * DAY;
  const s = computeBackupSafety({
    entries: [entry('e1', backupAt - DAY)], lastBackupAt: backupAt, now: NOW,
  });
  assert.equal(s.entriesSinceBackup, 0);
  assert.equal(s.shouldPromptOnHome, false, 'nothing has changed, so there is nothing to warn about');
  assert.equal(describeLastBackup(s), 'Exported 3 months ago');
}

// 7. Dismissing silences the prompt until the pile grows by another threshold.
{
  const dismissedAt = BANNER_ENTRY_THRESHOLD;
  const justAfter = computeBackupSafety({
    entries: many(dismissedAt + 1, NOW), dismissedAtCount: dismissedAt, now: NOW,
  });
  assert.equal(justAfter.shouldPromptOnHome, false, 'one more entry must not bring it straight back');

  const muchLater = computeBackupSafety({
    entries: many(dismissedAt + BANNER_ENTRY_THRESHOLD, NOW), dismissedAtCount: dismissedAt, now: NOW,
  });
  assert.equal(muchLater.shouldPromptOnHome, true, 'but it returns once the risk has doubled');
}

// 8. The restore preview describes what the file holds.
{
  const backup = {
    appId: 'quetzaly',
    exportedAt: '2026-11-20T10:00:00.000Z',
    data: {
      entries: [
        entry('a', NOW, { date: '2026-09-02', currency: 'GTQ' }),
        entry('b', NOW, { date: '2026-11-18', currency: 'USD' }),
        entry('c', NOW, { date: '2026-10-05', currency: 'USD' }),
      ],
      recurring: [{ id: 'r1' }],
      categories: [{ id: 'c1' }, { id: 'c2' }],
      settings: { homeCurrency: 'usd' },
    },
  };
  const s = summariseBackupContents(backup);
  assert.equal(s.entryCount, 3);
  assert.equal(s.recurringCount, 1);
  assert.equal(s.categoryCount, 2);
  assert.equal(s.firstDate, '2026-09-02');
  assert.equal(s.lastDate, '2026-11-18');
  assert.deepEqual(s.currencies, ['USD', 'GTQ'], 'most used first');
  assert.equal(s.homeCurrency, 'USD');
  assert.equal(s.exportedAt, '2026-11-20T10:00:00.000Z');
}

// 9. The preview survives an empty or malformed file without throwing.
{
  const empty = summariseBackupContents({ data: { entries: [] } });
  assert.equal(empty.entryCount, 0);
  assert.equal(empty.firstDate, null);
  assert.deepEqual(empty.currencies, []);

  const junk = summariseBackupContents(null);
  assert.equal(junk.entryCount, 0);
  assert.equal(junk.homeCurrency, null);
}

console.log('All backup-safety tests passed.');
