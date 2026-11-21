/**
 * Verification suite for:
 * 1. Dual-currency History rows & Transaction Detail View metadata
 * 2. Cross-border sample budget (GBP/USD/MXN), offline fixed FX, idempotent loading & surgical clear
 * 3. Insights category change ranking, zero-baseline, cycle-start-day-22, differing month lengths, and drill-down sums
 */
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {
  addEntry,
  clearAllSampleData,
  exportDatabase,
  getAllEntries,
  getAllLimits,
  getAllRecurringOccurrences,
  getAllRecurringRules,
  importDatabase,
  initDefaultCategoriesIfNeeded,
  loadCrossBorderSampleToDB,
  saveLimit,
  saveRecurringRule,
  saveStoredSettings,
} from '../src/lib/db';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
  generateCrossBorderSampleData,
} from '../src/lib/defaults';
import {
  buildEntryDetailPresentation,
  buildHistoryRowPresentation,
} from '../src/lib/entryDisplay';
import {
  calculateInsightsComparison,
  getEntryHomeCents,
} from '../src/lib/insightsMath';
import {
  calculatePeriodSummary,
  getOffsetPeriod,
  getPeriodForAnchor,
  getPeriodForDate,
} from '../src/lib/periodMath';
import { getNextOccurrenceDate } from '../src/lib/recurringMath';
import { BudgetLimit, FinanceEntry, RecurringRule } from '../src/types/finance';

async function run() {
  console.log('=== QUETZALY IMPROVEMENTS VERIFICATION SUITE ===\n');

  // ---------------------------------------------------------------------------
  // 1. HISTORY & DETAIL VIEW PRESENTATION + LEGACY METADATA + BACKUP ROUNDTRIP
  // ---------------------------------------------------------------------------
  console.log('1. Testing History rows, Detail view & legacy rate metadata...');
  const leisureCat = DEFAULT_CATEGORIES.find((c) => c.id === 'cat_leisure')!;
  const salaryCat = DEFAULT_CATEGORIES.find((c) => c.id === 'cat_salary')!;
  const diningCat = DEFAULT_CATEGORIES.find((c) => c.id === 'cat_dining')!;

  const foreignGandhi: FinanceEntry = {
    id: 'test_foreign_gandhi',
    type: 'expense',
    amount: 45000, // MXN 450.00
    currency: 'MXN',
    homeAmount: 1800, // GBP 18.00
    rate: 0.04,
    rateStatus: 'fetched',
    rateEditedManually: false,
    rateDate: '2026-11-15',
    rateSource: 'Frankfurter',
    date: '2026-11-16',
    categoryId: 'cat_leisure',
    note: 'Librería Gandhi',
    createdAt: 1000,
    updatedAt: 1000,
  };

  const rowForeign = buildHistoryRowPresentation(foreignGandhi, leisureCat, 'GBP');
  assert.equal(rowForeign.title, 'Librería Gandhi');
  assert.equal(rowForeign.conversionLine, 'MXN 450 · GBP 18');
  assert.equal(rowForeign.primaryAmountText, 'GBP 18');
  assert.equal(rowForeign.isIncome, false);
  assert.equal(rowForeign.isForeign, true);

  const detailForeign = buildEntryDetailPresentation(foreignGandhi, 'GBP');
  assert.equal(detailForeign.originalAmountText, 'MXN 450');
  assert.equal(detailForeign.homeEquivalentText, 'GBP 18');
  assert.equal(detailForeign.rateDirectionText, '1 MXN = 0.0400 GBP');
  assert.equal(detailForeign.rateDateText, 'Nov 15, 2026');
  assert.equal(detailForeign.rateSourceText, 'Provider rate (Frankfurter)');

  // Manual rate foreign entry
  const manualEntry: FinanceEntry = {
    ...foreignGandhi,
    id: 'test_manual_entry',
    rateStatus: 'manual',
    rateEditedManually: true,
    rateDate: '2026-11-19',
    rateSource: 'Manual',
  };
  const detailManual = buildEntryDetailPresentation(manualEntry, 'GBP');
  assert.equal(detailManual.rateSourceText, 'Manually entered rate');
  assert.equal(detailManual.rateDateText, 'Nov 19, 2026');

  // Foreign income distinct from expense
  const foreignIncome: FinanceEntry = {
    id: 'test_foreign_income',
    type: 'income',
    amount: 180000, // GBP 1,800.00
    currency: 'GBP',
    homeAmount: 4500000, // MXN 45,000.00
    rate: 25,
    rateStatus: 'fetched',
    rateEditedManually: false,
    rateDate: '2026-11-15',
    rateSource: 'Frankfurter',
    date: '2026-11-01',
    categoryId: 'cat_salary',
    note: 'UK remote salary (GBP)',
    createdAt: 1000,
    updatedAt: 1000,
  };
  const rowIncome = buildHistoryRowPresentation(foreignIncome, salaryCat, 'MXN');
  assert.equal(rowIncome.isIncome, true);
  assert.equal(rowIncome.conversionLine, 'GBP 1,800 · MXN 45,000');
  assert.equal(rowIncome.primaryAmountText, '+MXN 45,000');

  // Home-currency entry shows amount once
  const homeCoffee: FinanceEntry = {
    id: 'test_home_coffee',
    type: 'expense',
    amount: 350, // GBP 3.50
    currency: 'GBP',
    homeAmount: 350,
    rate: 1.0,
    rateStatus: 'fetched',
    rateEditedManually: false,
    date: '2026-11-18',
    categoryId: 'cat_dining',
    note: 'Morning flat white',
    createdAt: 1000,
    updatedAt: 1000,
  };
  const rowHome = buildHistoryRowPresentation(homeCoffee, diningCat, 'GBP');
  assert.equal(rowHome.isForeign, false);
  assert.equal(rowHome.conversionLine, undefined);
  assert.equal(rowHome.primaryAmountText, 'GBP 3.50');

  // Legacy entry missing rateDate & rateSource -> NEVER substitutes entry.date or invents provider
  const legacyEntry: FinanceEntry = {
    id: 'test_legacy_entry',
    type: 'expense',
    amount: 25000,
    currency: 'MXN',
    homeAmount: 1125,
    rate: 0.045,
    rateStatus: 'fetched',
    rateEditedManually: false,
    date: '2026-09-01',
    categoryId: 'cat_dining',
    note: 'Legacy taco dinner',
    createdAt: 1000,
    updatedAt: 1000,
  };
  const detailLegacy = buildEntryDetailPresentation(legacyEntry, 'GBP');
  assert.equal(detailLegacy.rateDateText, 'Rate date unavailable');
  assert.equal(detailLegacy.rateSourceText, 'Source unavailable');

  console.log('   - Foreign expense row:', rowForeign.title, '|', rowForeign.conversionLine);
  console.log('   - Foreign detail:', detailForeign.rateDirectionText, '|', detailForeign.rateDateText, '|', detailForeign.rateSourceText);
  console.log('   - Manual detail:', detailManual.rateSourceText, '|', detailManual.rateDateText);
  console.log('   - Legacy detail:', detailLegacy.rateDateText, '|', detailLegacy.rateSourceText);
  console.log('   - Home row:', rowHome.title, '|', rowHome.primaryAmountText, '(no duplicate currency line)');

  // ---------------------------------------------------------------------------
  // 2. CROSS-BORDER SAMPLE DATA ACROSS GBP, USD, MXN + OFFLINE + IDEMPOTENCY + CLEAR
  // ---------------------------------------------------------------------------
  console.log('\n2. Testing cross-border sample data across GBP, USD, MXN...');
  const fixedNow = new Date(2026, 10, 20); // Nov 20, 2026 (2026-11-20)
  for (const homeCurr of ['GBP', 'USD', 'MXN'] as const) {
    const bundle = generateCrossBorderSampleData(homeCurr, undefined, 22, fixedNow);
    const salary = bundle.entries.find((e) => e.id === 'sample_entry_curr_salary')!;
    const gandhi = bundle.entries.find((e) => e.id === 'sample_entry_curr_gandhi')!;
    const usdSub = bundle.recurringRules.find((r) => r.id === 'sample_rule_usd_sub')!;
    const rentRule = bundle.recurringRules.find((r) => r.id === 'sample_rule_rent')!;
    const groceriesLimit = bundle.limits.find((l) => l.id === 'sample_limit_cat_groceries')!;

    assert.equal(salary.currency, 'GBP', `Salary must remain GBP even when home is ${homeCurr}`);
    assert.equal(salary.amount, 180000);
    assert.equal(gandhi.currency, 'MXN', `Gandhi must remain MXN even when home is ${homeCurr}`);
    assert.equal(gandhi.amount, 45000);
    assert.equal(gandhi.note, 'Librería Gandhi');
    assert.equal(usdSub.currency, 'USD');
    assert.equal(usdSub.amount, 1800);
    assert.equal(rentRule.currency, 'MXN');
    assert.equal(rentRule.amount, 950000);
    assert.equal(groceriesLimit.categoryId, 'cat_groceries');

    if (homeCurr === 'GBP') {
      assert.equal(salary.homeAmount, 180000);
      assert.equal(gandhi.homeAmount, 1800); // GBP 18.00
    } else if (homeCurr === 'USD') {
      assert.equal(salary.homeAmount, 225000); // USD 2,250.00
      assert.equal(gandhi.homeAmount, 2250); // USD 22.50
    } else {
      assert.equal(salary.homeAmount, 4500000); // MXN 45,000.00
      assert.equal(gandhi.homeAmount, 45000); // MXN 450.00
    }

    // Rent must be scheduled before next payday & NOT counted as current spending yet
    const activePeriod = getPeriodForDate(fixedNow, 22);
    const nextRent = getNextOccurrenceDate(rentRule, '2026-11-20');
    assert.ok(
      nextRent && nextRent > '2026-11-20' && nextRent <= activePeriod.endDate,
      `Rent (${nextRent}) must be scheduled before next payday (${activePeriod.endDate})`
    );
    const currPeriodSummary = calculatePeriodSummary(bundle.entries, activePeriod, false);
    const currRentEntries = bundle.entries.filter(
      (e) => e.recurringId === 'sample_rule_rent' && e.date >= activePeriod.startDate
    );
    assert.equal(currRentEntries.length, 0, 'Upcoming unpaid rent must not be posted in current spending');
    assert.ok(currPeriodSummary.periodExpenses > 0);
  }
  console.log('   - Verified GBP, USD, MXN sample conversions, fixed offline rates, and scheduled unpaid rent.');

  // Seed DB with real user data + custom Food & Groceries limit + custom Rent rule
  await saveStoredSettings({
    ...DEFAULT_SETTINGS,
    homeCurrency: 'GBP',
    lastUsedCurrency: 'GBP',
    monthStartDay: 22,
    rolloverEnabled: false,
  });
  await initDefaultCategoriesIfNeeded();

  const userEntry: FinanceEntry = {
    id: 'user_entry_real_1',
    type: 'expense',
    amount: 50000, // MXN 500.00
    currency: 'MXN',
    homeAmount: 2000, // GBP 20.00
    rate: 0.04,
    rateStatus: 'fetched',
    rateEditedManually: false,
    rateDate: '2026-11-18',
    rateSource: 'Frankfurter',
    date: '2026-11-18',
    categoryId: 'cat_dining',
    note: 'User real dinner',
    isSample: false,
    createdAt: 1763400000000,
    updatedAt: 1763400000000,
  };
  const userGroceriesLimit: BudgetLimit = {
    id: 'user_limit_groceries',
    type: 'category',
    categoryId: 'cat_groceries',
    amount: 25000, // GBP 250.00
    createdAt: 1763400000000,
    updatedAt: 1763400000000,
  };
  const userRentRule: RecurringRule = {
    id: 'user_rule_rent',
    type: 'expense',
    amount: 120000, // GBP 1,200.00
    currency: 'GBP',
    categoryId: 'cat_housing',
    note: 'User real London flat rent',
    frequency: 'monthly',
    startDate: '2026-10-25',
    monthlyDay: 25,
    active: true,
    autoAdd: false,
    createdAt: 1763400000000,
    updatedAt: 1763400000000,
  };

  await addEntry(userEntry);
  await saveLimit(userGroceriesLimit);
  await saveRecurringRule(userRentRule);

  // Load sample data TWICE -> assert zero duplicates!
  const firstLoad = await loadCrossBorderSampleToDB('GBP', 22, fixedNow);
  const secondLoad = await loadCrossBorderSampleToDB('GBP', 22, fixedNow);

  assert.equal(firstLoad.entries.length, 17, '1 user entry + 16 sample entries');
  assert.equal(secondLoad.entries.length, 17, 'Double load must NOT duplicate entries');
  assert.equal(secondLoad.limits.length, 2, '1 user limit + 1 sample limit');
  assert.equal(secondLoad.recurringRules.length, 3, '1 user rule + 2 sample rules');

  // Verify JSON Backup export & replace preserves rateDate, rateSource & isSample
  const { backup } = await exportDatabase(false);
  const exportedUserEntry = backup.data.entries.find((e: FinanceEntry) => e.id === 'user_entry_real_1');
  assert.equal(exportedUserEntry.rateDate, '2026-11-18');
  assert.equal(exportedUserEntry.rateSource, 'Frankfurter');
  await importDatabase(backup, 'replace');
  const restoredEntries = await getAllEntries();
  const restoredUserEntry = restoredEntries.find((e) => e.id === 'user_entry_real_1')!;
  assert.equal(restoredUserEntry.rateDate, '2026-11-18');
  assert.equal(restoredUserEntry.rateSource, 'Frankfurter');
  console.log('   - Double-load idempotency & JSON backup round-trip for rateDate/rateSource PASSED.');

  // Clear sample data -> assert ONLY sample items removed, user entry + limit + rent rule survive
  const cleared = await clearAllSampleData();
  assert.equal(cleared.entries, 16);
  assert.equal(cleared.limits, 1);
  assert.equal(cleared.recurring, 2);
  assert.equal(cleared.recurringOccurrences, 3);

  const postClearEntries = await getAllEntries();
  const postClearLimits = await getAllLimits();
  const postClearRules = await getAllRecurringRules();
  const postClearOccs = await getAllRecurringOccurrences();

  assert.deepEqual(
    postClearEntries.map((e) => e.id),
    ['user_entry_real_1'],
    'User entry must survive sample clear'
  );
  assert.deepEqual(
    postClearLimits.map((l) => l.id),
    ['user_limit_groceries'],
    'User Food & Groceries limit must survive sample clear'
  );
  assert.deepEqual(
    postClearRules.map((r) => r.id),
    ['user_rule_rent'],
    'User Rent rule must survive sample clear'
  );
  assert.equal(postClearOccs.length, 0);
  console.log('   - Surgical sample cleanup preserved user entry, groceries limit, and rent rule.');

  // ---------------------------------------------------------------------------
  // 3. INSIGHTS MATH: 850->1190 (+40%), ZERO BASELINE, START DAY 22, FEB/MAR, DRILLDOWN
  // ---------------------------------------------------------------------------
  console.log('\n3. Testing Insights comparison math & drill-down equality...');

  // Case A: Active cycle starting on 22nd, day 12 (Oct 22 - Nov 21 viewed on Nov 2, 2026)
  const day12Now = new Date(2026, 10, 2); // 2026-11-02 (day 12 of Oct 22..Nov 21)
  const activeOct22 = getPeriodForDate(day12Now, 22);
  const prevSep22 = getOffsetPeriod(activeOct22, -1, 22); // Sep 22 .. Oct 21

  const syntheticEntries: FinanceEntry[] = [
    // Previous cycle within days 1..12 (Sep 22 .. Oct 3): Groceries 850.00
    {
      id: 'i_prev_groc_1',
      type: 'expense',
      amount: 85000,
      currency: 'GBP',
      homeAmount: 85000,
      rate: 1.0,
      rateStatus: 'fetched',
      rateEditedManually: false,
      date: '2026-09-25',
      categoryId: 'cat_groceries',
      note: 'Sep groceries',
      createdAt: 1,
      updatedAt: 1,
    },
    // Previous cycle AFTER day 12 (Oct 15): Dining 200.00 (excluded in same_day, included in full_cycle)
    {
      id: 'i_prev_dining_late',
      type: 'expense',
      amount: 20000,
      currency: 'GBP',
      homeAmount: 20000,
      rate: 1.0,
      rateStatus: 'fetched',
      rateEditedManually: false,
      date: '2026-10-15',
      categoryId: 'cat_dining',
      note: 'Late cycle dinner',
      createdAt: 2,
      updatedAt: 2,
    },
    // Current cycle within days 1..12 (Oct 22 .. Nov 2): Groceries 1,190.00 (+340.00 / +40%)
    {
      id: 'i_curr_groc_1',
      type: 'expense',
      amount: 70000,
      currency: 'GBP',
      homeAmount: 70000,
      rate: 1.0,
      rateStatus: 'fetched',
      rateEditedManually: false,
      date: '2026-10-24',
      categoryId: 'cat_groceries',
      note: 'Oct shop',
      createdAt: 3,
      updatedAt: 3,
    },
    {
      id: 'i_curr_groc_2',
      type: 'expense',
      amount: 49000,
      currency: 'GBP',
      homeAmount: 49000,
      rate: 1.0,
      rateStatus: 'fetched',
      rateEditedManually: false,
      date: '2026-11-01',
      categoryId: 'cat_groceries',
      note: 'Nov shop',
      createdAt: 4,
      updatedAt: 4,
    },
    // Current cycle New spending (previous = 0): Entertainment 45.00
    {
      id: 'i_curr_leisure_new',
      type: 'expense',
      amount: 4500,
      currency: 'GBP',
      homeAmount: 4500,
      rate: 1.0,
      rateStatus: 'fetched',
      rateEditedManually: false,
      date: '2026-11-02',
      categoryId: 'cat_leisure',
      note: 'Cinema tickets',
      createdAt: 5,
      updatedAt: 5,
    },
  ];

  const sameDayRes = calculateInsightsComparison({
    entries: syntheticEntries,
    categories: DEFAULT_CATEGORIES,
    activePeriod: activeOct22,
    previousPeriod: prevSep22,
    homeCurrency: 'GBP',
    mode: 'same_day',
    now: day12Now,
  });

  assert.equal(sameDayRes.ranges.currentRange.startDate, '2026-10-22');
  assert.equal(sameDayRes.ranges.currentRange.endDate, '2026-11-02');
  assert.equal(sameDayRes.ranges.currentRange.dayCount, 12);
  assert.equal(sameDayRes.ranges.previousRange.startDate, '2026-09-22');
  assert.equal(sameDayRes.ranges.previousRange.endDate, '2026-10-03');
  assert.equal(sameDayRes.ranges.previousRange.dayCount, 12);

  // Dining on Oct 15 must NOT appear in same_day; zero-both categories omitted
  assert.deepEqual(
    sameDayRes.categories.map((c) => c.category.id),
    ['cat_groceries', 'cat_leisure']
  );

  const grocSameDay = sameDayRes.categories[0];
  assert.equal(grocSameDay.previousAmountCents, 85000);
  assert.equal(grocSameDay.currentAmountCents, 119000);
  assert.equal(grocSameDay.diffCents, 34000);
  assert.equal(grocSameDay.pctChange, 40);
  assert.ok(grocSameDay.changeLine.includes('increased by GBP 340 (+40%)'));

  const leisureSameDay = sameDayRes.categories[1];
  assert.equal(leisureSameDay.isNewSpending, true);
  assert.equal(leisureSameDay.pctChange, null);
  assert.ok(leisureSameDay.changeLine.includes('New spending'));

  // Toggle to full_cycle -> Oct 15 Dining IS included
  const fullCycleRes = calculateInsightsComparison({
    entries: syntheticEntries,
    categories: DEFAULT_CATEGORIES,
    activePeriod: activeOct22,
    previousPeriod: prevSep22,
    homeCurrency: 'GBP',
    mode: 'full_cycle',
    now: day12Now,
  });
  assert.equal(fullCycleRes.ranges.previousRange.endDate, '2026-10-21');
  assert.ok(fullCycleRes.categories.some((c) => c.category.id === 'cat_dining' && c.previousAmountCents === 20000));

  // Verify drill-down sums strictly match category totals
  for (const item of fullCycleRes.categories) {
    const currSum = item.currentEntries.reduce((s, e) => s + getEntryHomeCents(e), 0);
    const prevSum = item.previousEntries.reduce((s, e) => s + getEntryHomeCents(e), 0);
    assert.equal(currSum, item.currentAmountCents, `Drill-down current sum mismatch for ${item.category.name}`);
    assert.equal(prevSum, item.previousAmountCents, `Drill-down previous sum mismatch for ${item.category.name}`);
  }

  // Case B: Differing month lengths (March day 30 vs 28-day February)
  const mar30Now = new Date(2026, 2, 30); // 2026-03-30
  const marPeriod = getPeriodForAnchor(2026, 2, 1); // Mar 1 - Mar 31
  const febPeriod = getPeriodForAnchor(2026, 1, 1); // Feb 1 - Feb 28 (non-leap 2026)
  const marVsFebRes = calculateInsightsComparison({
    entries: [],
    categories: DEFAULT_CATEGORIES,
    activePeriod: marPeriod,
    previousPeriod: febPeriod,
    homeCurrency: 'GBP',
    mode: 'same_day',
    now: mar30Now,
  });
  assert.equal(marVsFebRes.ranges.currentRange.startDate, '2026-03-01');
  assert.equal(marVsFebRes.ranges.currentRange.endDate, '2026-03-30');
  assert.equal(marVsFebRes.ranges.currentRange.dayCount, 30);
  assert.equal(marVsFebRes.ranges.previousRange.startDate, '2026-02-01');
  assert.equal(marVsFebRes.ranges.previousRange.endDate, '2026-02-28');
  assert.equal(marVsFebRes.ranges.previousRange.dayCount, 28);

  // Case C: Completed cycle defaults to full_cycle and cannot toggle to same_day
  const completedRes = calculateInsightsComparison({
    entries: [],
    categories: DEFAULT_CATEGORIES,
    activePeriod: prevSep22,
    previousPeriod: getOffsetPeriod(prevSep22, -1, 22),
    homeCurrency: 'GBP',
    mode: 'same_day',
    now: day12Now,
  });
  assert.equal(completedRes.ranges.cycleStatus, 'completed');
  assert.equal(completedRes.ranges.mode, 'full_cycle');
  assert.equal(completedRes.ranges.canToggleMode, false);

  // Worked Cross-Tab Trace on real Cross-Border Demo in GBP
  const gbpDemo = generateCrossBorderSampleData('GBP', undefined, 22, fixedNow);
  const demoGandhi = gbpDemo.entries.find((e) => e.id === 'sample_entry_curr_gandhi')!;
  const demoCurrPeriod = getPeriodForDate(fixedNow, 22);
  const demoPrevPeriod = getOffsetPeriod(demoCurrPeriod, -1, 22);
  const demoHistoryRow = buildHistoryRowPresentation(demoGandhi, leisureCat, 'GBP');
  const demoDetail = buildEntryDetailPresentation(demoGandhi, 'GBP');
  const demoInsights = calculateInsightsComparison({
    entries: gbpDemo.entries,
    categories: DEFAULT_CATEGORIES,
    activePeriod: demoCurrPeriod,
    previousPeriod: demoPrevPeriod,
    homeCurrency: 'GBP',
    mode: 'same_day',
    now: fixedNow,
  });
  const demoLeisureItem = demoInsights.categories.find((c) => c.category.id === 'cat_leisure')!;
  assert.equal(demoLeisureItem.currentAmountCents, demoGandhi.homeAmount);
  assert.equal(demoLeisureItem.currentEntries[0].id, demoGandhi.id);

  console.log('\n4. Worked End-to-End Foreign Purchase Trace (GBP Home):');
  console.log(`   - Entry ID: ${demoGandhi.id} (${demoGandhi.date})`);
  console.log(`   - History Row: "${demoHistoryRow.title}" | "${demoHistoryRow.conversionLine}" | Right: "${demoHistoryRow.primaryAmountText}"`);
  console.log(`   - Detail View: Original=${demoDetail.originalAmountText} | Home=${demoDetail.homeEquivalentText} | Rate=${demoDetail.rateDirectionText} | Date=${demoDetail.rateDateText} | Source=${demoDetail.rateSourceText}`);
  console.log(`   - Insights Category: "${demoLeisureItem.changeLine}" | Drill-down entries=${demoLeisureItem.currentEntries.length} | Sum=${demoLeisureItem.currentAmountCents} minor units (GBP 18)`);

  console.log('\n=== ALL IMPROVEMENT TESTS PASSED ===');
}

run().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
