/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'fake-indexeddb/auto';
import {
  getAllEntries,
  getAllCategories,
  getStoredSettings,
  saveStoredSettings,
  initDefaultCategoriesIfNeeded,
  exportDatabase,
  importDatabase,
  validateBackup,
  getAllRecurringRules,
  saveRecurringRule,
  getRecurringOccurrencesMap,
  saveRecurringOccurrence,
  bulkSaveRecurringOccurrences,
  getAllRecurringOccurrences,
} from '../src/lib/db';
import { getPendingDueOccurrences, getTodayDateString } from '../src/lib/recurringMath';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';
import { RecurringRule, RecurringOccurrence } from '../src/types/finance';

async function run() {
  console.log('===========================================================');
  console.log('   QUETZALY BACKUP REAL TEST: RECURRING RULES & OCCURRENCES');
  console.log('===========================================================\n');

  // 1. Setup DB with default settings
  await saveStoredSettings(DEFAULT_SETTINGS);
  await initDefaultCategoriesIfNeeded();

  const today = getTodayDateString();

  // 2. Add 3 recurring rules
  const rule1: RecurringRule = {
    id: 'rec_rule_rent',
    type: 'expense',
    amount: 1200000, // MX$12,000
    currency: 'MXN',
    categoryId: 'cat_housing',
    note: 'Monthly Rent',
    frequency: 'monthly',
    monthlyDay: 1,
    startDate: '2026-05-01',
    active: true,
    autoAdd: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const rule2: RecurringRule = {
    id: 'rec_rule_gym',
    type: 'expense',
    amount: 60000, // MX$600
    currency: 'MXN',
    categoryId: 'cat_health',
    note: 'Gym Membership',
    frequency: 'monthly',
    monthlyDay: 15,
    startDate: '2026-05-15',
    active: true,
    autoAdd: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const rule3: RecurringRule = {
    id: 'rec_rule_salary',
    type: 'income',
    amount: 3500000, // MX$35,000
    currency: 'MXN',
    categoryId: 'cat_salary',
    note: 'Monthly Salary',
    frequency: 'monthly',
    monthlyDay: 28,
    startDate: '2026-05-28',
    active: true,
    autoAdd: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await saveRecurringRule(rule1);
  await saveRecurringRule(rule2);
  await saveRecurringRule(rule3);

  // Record 2 posted occurrences and 1 skipped occurrence
  const occ1: RecurringOccurrence = {
    id: `${rule1.id}_2026-05-01`,
    ruleId: rule1.id,
    date: '2026-05-01',
    status: 'posted',
    entryId: 'entry_rent_0501',
    updatedAt: Date.now(),
  };

  const occ2: RecurringOccurrence = {
    id: `${rule2.id}_2026-05-15`,
    ruleId: rule2.id,
    date: '2026-05-15',
    status: 'posted',
    entryId: 'entry_gym_0515',
    updatedAt: Date.now(),
  };

  const occ3: RecurringOccurrence = {
    id: `${rule3.id}_2026-05-28`,
    ruleId: rule3.id,
    date: '2026-05-28',
    status: 'skipped',
    updatedAt: Date.now(),
  };

  await bulkSaveRecurringOccurrences([occ1, occ2, occ3]);

  // A. Snapshot BEFORE Export
  const rulesBefore = await getAllRecurringRules();
  const occsBefore = await getAllRecurringOccurrences();
  const occMapBefore = await getRecurringOccurrencesMap();

  console.log('1. BEFORE EXPORT:');
  console.log(`   - Rule count before export: ${rulesBefore.length}`);
  console.log(`   - Occurrence count before export: ${occsBefore.length} (2 posted, 1 skipped)`);

  // Verify pending due occurrences for rule1 up to 2026-06-01
  const pendingRule1Before = getPendingDueOccurrences(rule1, '2026-06-01', occMapBefore);
  console.log(`   - Pending due occurrences for rule1 up to 2026-06-01: [${pendingRule1Before.join(', ')}] (2026-05-01 was posted, so only 2026-06-01 is pending)`);

  // B. EXPORT BACKUP
  const exportRes = await exportDatabase(false);
  const backup = exportRes.backup;

  console.log('\n2. EXPORT COMPLETED:');
  console.log(`   - appId: "${backup.appId}"`);
  console.log(`   - schemaVersion: ${backup.schemaVersion}`);
  console.log(`   - rules in backup: ${backup.data.recurring.length}`);
  console.log(`   - occurrences in backup: ${backup.data.recurringOccurrences.length}`);

  // C. WIPE DEVICE (Simulate clean device)
  const db = await (await import('../src/lib/db')).getDB();
  const tx = db.transaction(['recurring', 'recurring_occurrences', 'entries'], 'readwrite');
  tx.objectStore('recurring').clear();
  tx.objectStore('recurring_occurrences').clear();
  tx.objectStore('entries').clear();
  await new Promise((res) => (tx.oncomplete = res));

  const rulesAfterWipe = await getAllRecurringRules();
  const occsAfterWipe = await getAllRecurringOccurrences();

  console.log('\n3. AFTER WIPING DEVICE:');
  console.log(`   - Rule count after wiping: ${rulesAfterWipe.length}`);
  console.log(`   - Occurrence count after wiping: ${occsAfterWipe.length}`);

  // D. IMPORT BACKUP WITH REPLACE
  const importedEntriesCount = await importDatabase(backup, 'replace');

  const rulesAfterImport = await getAllRecurringRules();
  const occsAfterImport = await getAllRecurringOccurrences();
  const occMapAfterImport = await getRecurringOccurrencesMap();

  console.log('\n4. AFTER IMPORT (REPLACE):');
  console.log(`   - Imported entries count: ${importedEntriesCount}`);
  console.log(`   - Rule count after import: ${rulesAfterImport.length}`);
  console.log(`   - Occurrence count after import: ${occsAfterImport.length}`);

  // Verify that posted and skipped occurrences are NOT offered again after import
  const pendingRule1After = getPendingDueOccurrences(rule1, '2026-06-01', occMapAfterImport);
  const pendingRule3After = getPendingDueOccurrences(rule3, '2026-05-28', occMapAfterImport);

  console.log('\n5. OCCURRENCE RE-OFFER VERIFICATION:');
  console.log(`   - Rule 1 (posted on 2026-05-01) pending dates up to 2026-06-01: [${pendingRule1After.join(', ')}]`);
  console.log(`   - Rule 3 (skipped on 2026-05-28) pending dates up to 2026-05-28: [${pendingRule3After.join(', ')}] (must be empty)`);

  const reofferCheckPassed = !pendingRule1After.includes('2026-05-01') && pendingRule3After.length === 0;
  console.log(`   - Re-offer verification result: ${reofferCheckPassed ? 'PASSED (Posted and skipped occurrences NOT offered again)' : 'FAILED'}`);

  // E. TEST MERGE MODE
  // Add a 4th rule on device
  const rule4: RecurringRule = {
    id: 'rec_rule_new_device',
    type: 'expense',
    amount: 10000,
    currency: 'MXN',
    categoryId: 'cat_bills',
    note: 'Device specific rule',
    frequency: 'monthly',
    monthlyDay: 10,
    startDate: '2026-06-10',
    active: true,
    autoAdd: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveRecurringRule(rule4);

  await importDatabase(backup, 'merge');
  const rulesAfterMerge = await getAllRecurringRules();
  console.log('\n6. MERGE MODE VERIFICATION:');
  console.log(`   - Rule count after Merge: ${rulesAfterMerge.length} (3 from backup + 1 unique device rule)`);

  const mergePassed = rulesAfterMerge.length === 4;

  const allPassed =
    rulesBefore.length === 3 &&
    rulesAfterWipe.length === 0 &&
    rulesAfterImport.length === 3 &&
    occsAfterImport.length === 3 &&
    reofferCheckPassed &&
    mergePassed;

  console.log('\n===========================================================');
  console.log(`BACKUP TEST SUITE OVERALL RESULT: ${allPassed ? 'ALL PASSED!' : 'FAILED'}`);
  console.log('===========================================================');
}

run().catch((err) => {
  console.error('Backup test failed:', err);
  process.exit(1);
});
