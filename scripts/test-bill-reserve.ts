/**
 * Bill-reserve tests for Quetzaly.
 * Covers: reserving unpaid scheduled bills out of the daily allowance, the
 * double-count guard when a bill is posted, skipped bills, paused rules,
 * future income never counting as available, foreign-currency bills, and
 * a reserve larger than the balance.
 */
import assert from 'node:assert/strict';
import { computeBillReserve } from '../src/lib/billReserveMath';
import { calculateHeroCardMetrics } from '../src/lib/homeMath';
import { calculatePeriodSummary } from '../src/lib/periodMath';
import {
  BudgetPeriod,
  FinanceEntry,
  RecurringOccurrence,
  RecurringRule,
} from '../src/types/finance';

const PERIOD: BudgetPeriod = {
  id: 'period_2026-11-01_2026-11-30',
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  label: 'Nov 1 – 30, 2026',
  year: 2026,
  month: 10,
};

const TODAY = '2026-11-20';
const HOME = 'USD';
const noRates = () => null;

function rule(over: Partial<RecurringRule> & { id: string; amount: number }): RecurringRule {
  const ts = Date.now();
  return {
    type: 'expense',
    currency: HOME,
    categoryId: 'cat_bills',
    frequency: 'monthly',
    startDate: '2026-11-25',
    active: true,
    autoAdd: false,
    createdAt: ts,
    updatedAt: ts,
    ...over,
  } as RecurringRule;
}

function entry(over: Partial<FinanceEntry> & { id: string; date: string; amount: number }): FinanceEntry {
  const ts = Date.now();
  return {
    type: 'expense',
    currency: HOME,
    homeAmount: over.amount,
    rate: 1,
    rateStatus: 'fetched',
    rateEditedManually: false,
    categoryId: 'cat_bills',
    createdAt: ts,
    updatedAt: ts,
    ...over,
  } as FinanceEntry;
}

function occMap(list: RecurringOccurrence[]): Map<string, RecurringOccurrence> {
  return new Map(list.map((o) => [o.id, o]));
}

// 1. An upcoming bill is reserved, and only counted once it is still unpaid.
{
  const rules = [rule({ id: 'r_rent', amount: 90000, note: 'Rent' })];
  const res = computeBillReserve({
    rules, occurrences: occMap([]), period: PERIOD, today: TODAY, homeCurrency: HOME, getRate: noRates,
  });
  assert.equal(res.bills.length, 1, 'one occurrence falls inside the cycle');
  assert.equal(res.reservedCents, 90000);
  assert.equal(res.upcomingCents, 90000);
  assert.equal(res.overdueCents, 0);
  assert.equal(res.bills[0].isOverdue, false);
}

// 2. Once the bill is posted, it leaves the reserve. This is the double-count guard.
{
  const rules = [rule({ id: 'r_rent', amount: 90000 })];
  const posted: RecurringOccurrence = {
    id: 'r_rent_2026-11-25', ruleId: 'r_rent', date: '2026-11-25',
    status: 'posted', entryId: 'e1', updatedAt: Date.now(),
  };
  const res = computeBillReserve({
    rules, occurrences: occMap([posted]), period: PERIOD, today: TODAY, homeCurrency: HOME, getRate: noRates,
  });
  assert.equal(res.reservedCents, 0, 'a posted bill is an ordinary expense, never also a reserve');
  assert.equal(res.bills.length, 0);
}

// 3. A skipped bill is not owed either.
{
  const rules = [rule({ id: 'r_gym', amount: 5000 })];
  const skipped: RecurringOccurrence = {
    id: 'r_gym_2026-11-25', ruleId: 'r_gym', date: '2026-11-25',
    status: 'skipped', updatedAt: Date.now(),
  };
  const res = computeBillReserve({
    rules, occurrences: occMap([skipped]), period: PERIOD, today: TODAY, homeCurrency: HOME, getRate: noRates,
  });
  assert.equal(res.reservedCents, 0);
}

// 4. A paused rule reserves nothing.
{
  const rules = [rule({ id: 'r_paused', amount: 12345, active: false })];
  const res = computeBillReserve({
    rules, occurrences: occMap([]), period: PERIOD, today: TODAY, homeCurrency: HOME, getRate: noRates,
  });
  assert.equal(res.reservedCents, 0);
}

// 5. Future income is never treated as money already available.
{
  const rules = [rule({ id: 'r_salary', amount: 300000, type: 'income' })];
  const res = computeBillReserve({
    rules, occurrences: occMap([]), period: PERIOD, today: TODAY, homeCurrency: HOME, getRate: noRates,
  });
  assert.equal(res.bills.length, 0, 'income rules are out of scope for the reserve');
  assert.equal(res.reservedCents, 0);
}

// 6. An overdue unposted bill is still owed, and is reported separately.
{
  const rules = [rule({ id: 'r_phone', amount: 4500, startDate: '2026-11-05' })];
  const res = computeBillReserve({
    rules, occurrences: occMap([]), period: PERIOD, today: TODAY, homeCurrency: HOME, getRate: noRates,
  });
  assert.equal(res.overdueCents, 4500);
  assert.equal(res.upcomingCents, 0);
  assert.equal(res.bills[0].isOverdue, true);
}

// 7. Occurrences outside the cycle are ignored.
{
  const rules = [rule({ id: 'r_next', amount: 10000, startDate: '2026-12-05' })];
  const res = computeBillReserve({
    rules, occurrences: occMap([]), period: PERIOD, today: TODAY, homeCurrency: HOME, getRate: noRates,
  });
  assert.equal(res.bills.length, 0);
}

// 8. A foreign bill converts when a rate is known, and is excluded but surfaced when it is not.
{
  const rules = [rule({ id: 'r_mx', amount: 100000, currency: 'MXN' })];
  const withRate = computeBillReserve({
    rules, occurrences: occMap([]), period: PERIOD, today: TODAY, homeCurrency: HOME,
    getRate: (c) => (c === 'MXN' ? 0.05 : null),
  });
  assert.equal(withRate.reservedCents, 5000, 'MXN 1,000.00 at 0.05 is USD 50.00');
  assert.equal(withRate.unconvertedCount, 0);

  const withoutRate = computeBillReserve({
    rules, occurrences: occMap([]), period: PERIOD, today: TODAY, homeCurrency: HOME, getRate: noRates,
  });
  assert.equal(withoutRate.reservedCents, 0, 'never guess a rate');
  assert.equal(withoutRate.unconvertedCount, 1);
  assert.equal(withoutRate.bills.length, 1, 'but still tell the user it exists');
}

// 9. Weekly rules produce every occurrence inside the cycle.
{
  const rules = [rule({ id: 'r_week', amount: 2000, frequency: 'weekly', startDate: '2026-11-02' })];
  const res = computeBillReserve({
    rules, occurrences: occMap([]), period: PERIOD, today: TODAY, homeCurrency: HOME, getRate: noRates,
  });
  assert.equal(res.bills.length, 5, 'Nov 2, 9, 16, 23, 30');
  assert.equal(res.reservedCents, 10000);
  assert.equal(res.overdueCents, 6000, 'Nov 2, 9 and 16 are past Nov 20');
  assert.equal(res.upcomingCents, 4000, 'Nov 23 and 30 are ahead');
}

// 10. The hero card spreads only what is left after the reserve.
{
  const entries = [
    entry({ id: 'i1', date: '2026-11-01', amount: 200000, type: 'income', categoryId: 'cat_pay' }),
    entry({ id: 'e1', date: '2026-11-10', amount: 50000 }),
  ];
  const summary = calculatePeriodSummary(entries, PERIOD, false);
  const now = new Date(2026, 10, 20);

  const plain = calculateHeroCardMetrics({
    summary, currentEntries: entries, activePeriod: PERIOD, now,
  });
  assert.equal(plain.leftToSpendCents, 150000);
  assert.equal(plain.secondaryLabel, 'Daily allowance');
  assert.equal(plain.reservedForBillsCents, 0);
  assert.equal(plain.dailyAllowanceCents, Math.round(150000 / plain.daysRemaining));

  const reserved = calculateHeroCardMetrics({
    summary, currentEntries: entries, activePeriod: PERIOD, reservedForBillsCents: 90000, now,
  });
  assert.equal(reserved.leftToSpendCents, 150000, 'the headline balance is untouched');
  assert.equal(reserved.availableAfterBillsCents, 60000);
  assert.equal(reserved.secondaryLabel, 'Safe to spend a day');
  assert.equal(reserved.dailyAfterBillsCents, Math.round(60000 / reserved.daysRemaining));
  assert.ok(
    reserved.dailyAfterBillsCents! < plain.dailyAllowanceCents!,
    'reserving bills must lower the daily figure, never raise it'
  );
}

// 11. A reserve bigger than the balance floors the daily figure at zero.
{
  const entries = [entry({ id: 'i1', date: '2026-11-01', amount: 50000, type: 'income', categoryId: 'cat_pay' })];
  const summary = calculatePeriodSummary(entries, PERIOD, false);
  const m = calculateHeroCardMetrics({
    summary, currentEntries: entries, activePeriod: PERIOD,
    reservedForBillsCents: 90000, now: new Date(2026, 10, 20),
  });
  assert.equal(m.availableAfterBillsCents, -40000, 'the shortfall is reported honestly');
  assert.equal(m.dailyAfterBillsCents, 0, 'but never a negative allowance');
}

console.log('All bill-reserve tests passed.');
