/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'fake-indexeddb/auto';
import {
  getAllEntries,
  addEntry,
  deleteEntry,
  getAllCategories,
  getAllLimits,
  getStoredSettings,
  saveStoredSettings,
  initDefaultCategoriesIfNeeded,
  bulkAddEntries,
  saveLimit,
  exportDatabase,
  importDatabase,
  validateBackup,
  getAllRecurringRules,
  saveRecurringRule,
  deleteRecurringRule,
  getRecurringOccurrencesMap,
  saveRecurringOccurrence,
  bulkSaveRecurringOccurrences,
} from '../src/lib/db';
import {
  generateAllOccurrences,
  getPendingDueOccurrences,
  getMonthlyOccurrenceDate,
  getScheduleSummaryText,
  parseDate,
} from '../src/lib/recurringMath';
import { getPeriodForDate, calculatePeriodSummary } from '../src/lib/periodMath';
import { generateSampleEntries, DEFAULT_SETTINGS } from '../src/lib/defaults';
import { formatCents } from '../src/lib/currency';
import { RecurringRule, RecurringOccurrence, FinanceEntry } from '../src/types/finance';

async function run() {
  console.log('====================================================');
  console.log('   QUETZALY RECURRING SCHEDULE & START DATE TESTS   ');
  console.log('====================================================\n');

  // 0. Setup initial DB
  await saveStoredSettings(DEFAULT_SETTINGS);
  await initDefaultCategoriesIfNeeded();

  // ----------------------------------------------------
  // TEST 1: Monthly start on the 31st
  // ----------------------------------------------------
  console.log('TEST 1: Monthly start on the 31st (2026-01-31)');
  const ruleMonthly31: RecurringRule = {
    id: 'rule_monthly_31',
    type: 'expense',
    amount: 150000,
    currency: 'MXN',
    categoryId: 'cat_bills',
    note: 'Rent / Subscription 31st',
    frequency: 'monthly',
    monthlyDay: 31,
    startDate: '2026-01-31',
    active: true,
    autoAdd: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const summaryMonthly31 = getScheduleSummaryText('monthly', '2026-01-31', undefined, '2026-01-01');
  const occurrences31 = generateAllOccurrences(ruleMonthly31, '2026-04-30');
  console.log('   Live Summary Text: ', `"${summaryMonthly31}"`);
  console.log('   Occurrences Jan-Apr:', occurrences31);
  const t1Passed =
    summaryMonthly31.includes('Repeats monthly on the 31st') &&
    occurrences31.join(',') === '2026-01-31,2026-02-28,2026-03-31,2026-04-30';
  console.log(`   Result:             ${t1Passed ? 'PASSED' : 'FAILED'}\n`);

  // ----------------------------------------------------
  // TEST 2: Weekly start on a Thursday (2026-11-12)
  // ----------------------------------------------------
  console.log('TEST 2: Weekly start on a Thursday (2026-11-12)');
  const ruleWeeklyThu: RecurringRule = {
    id: 'rule_weekly_thu',
    type: 'expense',
    amount: 25000,
    currency: 'MXN',
    categoryId: 'cat_groceries',
    note: 'Thursday Market',
    frequency: 'weekly',
    startDate: '2026-11-12',
    active: true,
    autoAdd: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const summaryWeeklyThu = getScheduleSummaryText('weekly', '2026-11-12', undefined, '2026-11-01');
  const occurrencesThu = generateAllOccurrences(ruleWeeklyThu, '2026-12-03');
  console.log('   Live Summary Text: ', `"${summaryWeeklyThu}"`);
  console.log('   Occurrences Nov-Dec:', occurrencesThu);
  const t2Passed =
    summaryWeeklyThu.includes('Repeats every Thursday') &&
    occurrencesThu.join(',') === '2026-11-12,2026-11-19,2026-11-26,2026-12-03';
  console.log(`   Result:             ${t2Passed ? 'PASSED' : 'FAILED'}\n`);

  // ----------------------------------------------------
  // TEST 3: Yearly start on Feb 29 (Leap Year 2024-02-29)
  // ----------------------------------------------------
  console.log('TEST 3: Yearly start on Feb 29 (2024-02-29)');
  const ruleYearlyFeb29: RecurringRule = {
    id: 'rule_yearly_feb29',
    type: 'expense',
    amount: 500000,
    currency: 'MXN',
    categoryId: 'cat_other_exp',
    note: 'Leap Year Insurance',
    frequency: 'yearly',
    startDate: '2024-02-29',
    active: true,
    autoAdd: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const summaryYearlyFeb29 = getScheduleSummaryText('yearly', '2024-02-29', undefined, '2026-11-12');
  const occurrencesFeb29 = generateAllOccurrences(ruleYearlyFeb29, '2028-03-01');
  console.log('   Live Summary Text: ', `"${summaryYearlyFeb29}"`);
  console.log('   Occurrences 2024-2028:', occurrencesFeb29);
  const t3Passed =
    summaryYearlyFeb29.includes('Repeats yearly on Feb 29') &&
    occurrencesFeb29.join(',') === '2024-02-29,2025-02-28,2026-02-28,2027-02-28,2028-02-29';
  console.log(`   Result:             ${t3Passed ? 'PASSED' : 'FAILED'}\n`);

  // ----------------------------------------------------
  // TEST 4: Existing rule with a different stored monthlyDay
  // ----------------------------------------------------
  console.log('TEST 4: Existing rule with a different stored monthlyDay');
  const existingRuleLegacy: RecurringRule = {
    id: 'rule_legacy_diff_day',
    type: 'expense',
    amount: 80000,
    currency: 'MXN',
    categoryId: 'cat_bills',
    note: 'Internet legacy',
    frequency: 'monthly',
    monthlyDay: 1, // Stored legacy day = 1
    startDate: '2026-11-12', // Start date day = 12
    active: true,
    autoAdd: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await saveRecurringRule(existingRuleLegacy);
  const loadedBeforeEdit = (await getAllRecurringRules()).find((r) => r.id === existingRuleLegacy.id);
  console.log(`   Unedited stored monthlyDay: ${loadedBeforeEdit?.monthlyDay} (differs from startDate day 12)`);

  // Simulate user editing the rule in RecurringModal and saving
  const editedRule: RecurringRule = {
    ...loadedBeforeEdit!,
    monthlyDay: parseDate(loadedBeforeEdit!.startDate).day, // Derive from startDate (12)
    updatedAt: Date.now(),
  };
  await saveRecurringRule(editedRule);

  const loadedAfterEdit = (await getAllRecurringRules()).find((r) => r.id === existingRuleLegacy.id);
  console.log(`   Edited stored monthlyDay:   ${loadedAfterEdit?.monthlyDay} (now matches startDate day 12)`);

  const t4Passed =
    loadedBeforeEdit?.monthlyDay === 1 &&
    loadedAfterEdit?.monthlyDay === 12;
  console.log(`   Result:             ${t4Passed ? 'PASSED' : 'FAILED'}\n`);

  // Final summary
  const allPassed = t1Passed && t2Passed && t3Passed && t4Passed;
  console.log('====================================================');
  console.log(`OVERALL RESULT: ${allPassed ? 'ALL 4 TESTS PASSED SUCCESSFULLY!' : 'TESTS FAILED'}`);
  console.log('====================================================');
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
