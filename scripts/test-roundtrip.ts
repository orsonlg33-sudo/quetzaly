/**
 * Real round-trip test for Quetzaly backup and restore
 * Testing both matching home currency and differing home currency edge cases.
 */
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {
  getAllEntries,
  getAllCategories,
  getAllLimits,
  getStoredSettings,
  saveStoredSettings,
  initDefaultCategoriesIfNeeded,
  bulkAddEntries,
  deleteEntry,
  saveLimit,
  exportDatabase,
  importDatabase,
  validateBackup,
} from '../src/lib/db';
import { getPeriodForDate, calculatePeriodSummary } from '../src/lib/periodMath';
import { generateSampleEntries, DEFAULT_SETTINGS } from '../src/lib/defaults';
import { formatCents } from '../src/lib/currency';

const BACKUP_HOME_CURRENCY = 'MXN';
const DEVICE_HOME_CURRENCY = 'USD';
const TEST_START_DAY = 22;

async function run() {
  console.log('=== STARTING REAL QUETZALY BACKUP ROUND-TRIP TEST ===\n');

  // 1. Explicitly initialize DB with categories and MXN settings (do not rely on DEFAULT_SETTINGS)
  await saveStoredSettings({
    ...DEFAULT_SETTINGS,
    homeCurrency: BACKUP_HOME_CURRENCY,
    lastUsedCurrency: BACKUP_HOME_CURRENCY,
    monthStartDay: TEST_START_DAY,
    rolloverEnabled: false,
  });
  await initDefaultCategoriesIfNeeded();

  // Current period with start day 22
  const activePeriod = getPeriodForDate(new Date(), TEST_START_DAY);

  // Seed sample entries in MXN
  const sampleEntries = generateSampleEntries(BACKUP_HOME_CURRENCY, activePeriod.startDate);
  await bulkAddEntries(sampleEntries);

  // Add sample budget limits (1 overall limit MX$20,000, 1 category limit MX$4,000)
  await saveLimit({
    id: 'limit_overall',
    type: 'overall',
    amount: 2000000, // MX$20,000
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  await saveLimit({
    id: 'limit_cat_groceries',
    type: 'category',
    categoryId: 'cat_groceries',
    amount: 400000, // MX$4,000
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Helper to snapshot figures
  async function getSnapshot() {
    const entries = await getAllEntries();
    const cats = await getAllCategories();
    const lims = await getAllLimits();
    const settings = await getStoredSettings();

    const summary = calculatePeriodSummary(entries, activePeriod, settings.rolloverEnabled);
    return {
      entryCount: entries.length,
      categoryCount: cats.length,
      limitCount: lims.length,
      totalSpentCents: summary.periodExpenses,
      totalSpentFormatted: formatCents(summary.periodExpenses, settings.homeCurrency),
      leftToSpendCents: summary.netLeft,
      leftToSpendFormatted: formatCents(summary.netLeft, settings.homeCurrency),
      homeCurrency: settings.homeCurrency,
    };
  }

  // A. Snapshot BEFORE
  const before = await getSnapshot();
  assert.equal(before.homeCurrency, BACKUP_HOME_CURRENCY, 'Initial test DB must be MXN');
  assert.equal(before.entryCount, 11, 'Expected 11 seeded entries');
  console.log('1. BEFORE EXPORT:');
  console.log(`   - Entry count: ${before.entryCount}`);
  console.log(`   - Category count: ${before.categoryCount}`);
  console.log(`   - Limit count: ${before.limitCount}`);
  console.log(`   - Total spent this cycle: ${before.totalSpentFormatted} (${before.totalSpentCents} cents)`);
  console.log(`   - Left to spend: ${before.leftToSpendFormatted} (${before.leftToSpendCents} cents)`);
  console.log(`   - Home currency: ${before.homeCurrency}\n`);

  // B. Export
  const { backup, estimatedSizeKb } = await exportDatabase(false);
  assert.equal(backup.appId, 'quetzaly', 'Backup appId must be quetzaly');
  assert.equal(
    backup.data.settings.homeCurrency,
    BACKUP_HOME_CURRENCY,
    'Exported backup homeCurrency must explicitly be MXN'
  );
  console.log('2. EXPORT COMPLETED:');
  console.log(`   - appId: "${backup.appId}"`);
  console.log(`   - schemaVersion: ${backup.schemaVersion}`);
  console.log(`   - exportedAt: ${backup.exportedAt}`);
  console.log(`   - estimatedSizeKb: ~${estimatedSizeKb} KB`);
  console.log(`   - entries in backup: ${backup.data.entries.length}`);
  console.log(`   - categories in backup: ${backup.data.categories.length}`);
  console.log(`   - limits in backup: ${backup.data.limits.length}`);
  console.log(`   - homeCurrency in backup: ${backup.data.settings.homeCurrency}\n`);

  // C. Delete 3 entries and explicitly switch device home currency to USD
  const currentEntries = await getAllEntries();
  const deletedEntries = currentEntries.slice(0, 3);
  for (const entry of deletedEntries) {
    await deleteEntry(entry.id);
  }
  await saveStoredSettings({ homeCurrency: DEVICE_HOME_CURRENCY });

  const afterDeleteAndSwitch = await getSnapshot();
  assert.equal(afterDeleteAndSwitch.entryCount, before.entryCount - 3, 'Expected 8 entries after deleting 3');
  assert.equal(afterDeleteAndSwitch.homeCurrency, DEVICE_HOME_CURRENCY, 'Device homeCurrency must be USD');
  console.log('3. AFTER DELETING 3 ENTRIES AND SWITCHING DEVICE HOME CURRENCY TO USD:');
  console.log(`   - Entry count: ${afterDeleteAndSwitch.entryCount}`);
  console.log(`   - Category count: ${afterDeleteAndSwitch.categoryCount}`);
  console.log(`   - Limit count: ${afterDeleteAndSwitch.limitCount}`);
  console.log(`   - Total spent this cycle: ${afterDeleteAndSwitch.totalSpentFormatted} (${afterDeleteAndSwitch.totalSpentCents} cents)`);
  console.log(`   - Left to spend: ${afterDeleteAndSwitch.leftToSpendFormatted} (${afterDeleteAndSwitch.leftToSpendCents} cents)`);
  console.log(`   - Home currency: ${afterDeleteAndSwitch.homeCurrency}\n`);

  // D. Attempt to Import with Merge (Backup is MXN, Device is USD) -> MUST BE BLOCKED
  console.log('4. ATTEMPTING MERGE WITH CURRENCY MISMATCH (Backup: MXN, Device: USD):');
  let mergeBlocked = false;
  let mergeErrorMessage = '';
  try {
    await importDatabase(backup, 'merge');
  } catch (err: any) {
    mergeBlocked = true;
    mergeErrorMessage = err?.message || String(err);
  }

  assert.equal(mergeBlocked, true, 'Merge MUST be blocked when backup homeCurrency (MXN) differs from device (USD)');
  assert.equal(
    mergeErrorMessage,
    `This backup uses ${BACKUP_HOME_CURRENCY} as its home currency. This device uses ${DEVICE_HOME_CURRENCY}.`,
    'Expected clear in-app currency mismatch error message'
  );

  const afterBlockedMerge = await getSnapshot();
  assert.deepEqual(
    afterBlockedMerge,
    afterDeleteAndSwitch,
    'Device data must remain completely unchanged after blocked Merge'
  );

  console.log(`   - Merge blocked successfully: ${mergeBlocked}`);
  console.log(`   - Error message: "${mergeErrorMessage}"`);
  console.log(`   - Device data untouched: YES (100% UNTOUCHED)\n`);

  // E. Import with Replace (Restores MXN and all original data)
  console.log('5. IMPORT WITH REPLACE (Restores MXN backup over USD device):');
  const replacedCount = await importDatabase(backup, 'replace');
  const afterReplace = await getSnapshot();
  assert.equal(replacedCount, before.entryCount, 'Replace should restore all exported entries');
  console.log(`   - Replaced entries: ${replacedCount}`);
  console.log(`   - Entry count: ${afterReplace.entryCount}`);
  console.log(`   - Category count: ${afterReplace.categoryCount}`);
  console.log(`   - Limit count: ${afterReplace.limitCount}`);
  console.log(`   - Total spent this cycle: ${afterReplace.totalSpentFormatted} (${afterReplace.totalSpentCents} cents)`);
  console.log(`   - Left to spend: ${afterReplace.leftToSpendFormatted} (${afterReplace.leftToSpendCents} cents)`);
  console.log(`   - Home currency: ${afterReplace.homeCurrency}\n`);

  // Check equality with before
  assert.equal(afterReplace.entryCount, before.entryCount, 'Replace must restore exact entry count');
  assert.equal(afterReplace.categoryCount, before.categoryCount, 'Replace must restore exact category count');
  assert.equal(afterReplace.limitCount, before.limitCount, 'Replace must restore exact limit count');
  assert.equal(afterReplace.totalSpentCents, before.totalSpentCents, 'Replace must restore exact total spent');
  assert.equal(afterReplace.leftToSpendCents, before.leftToSpendCents, 'Replace must restore exact left to spend');
  assert.equal(afterReplace.homeCurrency, BACKUP_HOME_CURRENCY, 'Replace must restore MXN home currency');

  console.log('6. EQUALITY VERIFICATION (After Replace === Before): PASSED (EXACT MATCH)\n');

  // F. Test Merge when currencies match (both MXN)
  console.log('7. TESTING MERGE WHEN CURRENCIES MATCH (Both MXN):');
  const entriesBeforeSameCurrMerge = await getAllEntries();
  for (const entry of entriesBeforeSameCurrMerge.slice(0, 3)) {
    await deleteEntry(entry.id);
  }
  const midSnapshot = await getSnapshot();
  assert.equal(midSnapshot.entryCount, before.entryCount - 3, 'Expected 8 entries before same-currency Merge');
  console.log(`   - Deleted 3 entries. Current count: ${midSnapshot.entryCount}`);

  // Now Merge backup (which is also MXN)
  const sameCurrencyMergedCount = await importDatabase(backup, 'merge');
  const afterSameCurrMerge = await getSnapshot();
  assert.equal(sameCurrencyMergedCount, 3, 'Same-currency Merge should import the 3 missing entries');
  assert.equal(afterSameCurrMerge.entryCount, before.entryCount, 'Same-currency Merge must restore full entry count');
  assert.equal(afterSameCurrMerge.totalSpentCents, before.totalSpentCents, 'Same-currency Merge must restore total spent');
  assert.equal(afterSameCurrMerge.leftToSpendCents, before.leftToSpendCents, 'Same-currency Merge must restore left to spend');
  assert.equal(afterSameCurrMerge.homeCurrency, BACKUP_HOME_CURRENCY, 'Home currency must stay MXN');
  console.log(`   - Restored missing entries: ${sameCurrencyMergedCount}`);
  console.log(`   - Entry count after Merge: ${afterSameCurrMerge.entryCount}`);
  console.log(`   - Total spent after Merge: ${afterSameCurrMerge.totalSpentFormatted}`);
  console.log(`   - Left to spend after Merge: ${afterSameCurrMerge.leftToSpendFormatted}\n`);

  // G. Broken file tests
  console.log('8. TESTING BROKEN FILES:');
  const validation1 = validateBackup(null);
  assert.equal(validation1.valid, false, 'Null backup must fail validation');
  assert.equal(validation1.error, "This file isn't a valid backup. Choose a file exported from Quetzaly.");
  console.log(`   a) Not valid JSON: valid=${validation1.valid}, error="${validation1.error}"`);

  const wrongAppIdBackup = { ...backup, appId: 'not_quetzaly' };
  const validation2 = validateBackup(wrongAppIdBackup);
  assert.equal(validation2.valid, false, 'Wrong appId backup must fail validation');
  assert.equal(validation2.error, "This file wasn't exported from Quetzaly.");
  console.log(`   b) Wrong appId: valid=${validation2.valid}, error="${validation2.error}"`);

  const newerSchemaBackup = { ...backup, schemaVersion: 99 };
  const validation3 = validateBackup(newerSchemaBackup);
  assert.equal(validation3.valid, false, 'Newer schemaVersion backup must fail validation');
  assert.equal(validation3.error, 'This backup comes from a newer version of Quetzaly. Update the app and try again.');
  console.log(`   c) Newer schemaVersion: valid=${validation3.valid}, error="${validation3.error}"`);

  const finalSnapshot = await getSnapshot();
  assert.deepEqual(finalSnapshot, afterSameCurrMerge, 'Database must be untouched after broken file validations');
  console.log('   d) Database untouched after broken file tests: YES (100% UNTOUCHED)\n');

  console.log('=== TEST COMPLETE (ALL ASSERTIONS PASSED) ===');
}

run().catch((err) => {
  console.error('TEST FAILED:', err?.message || err);
  process.exit(1);
});
