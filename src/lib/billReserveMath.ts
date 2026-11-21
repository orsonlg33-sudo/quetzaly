/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BudgetPeriod,
  RecurringOccurrence,
  RecurringRule,
} from '../types/finance';
import { generateAllOccurrences } from './recurringMath';
import { calculateHomeAmountCents } from './exchangeRate';

/**
 * A scheduled bill inside the active cycle that has not been posted or skipped,
 * and is therefore still owed out of the money left to spend.
 */
export interface ReservedBill {
  ruleId: string;
  /** Occurrence date, YYYY-MM-DD */
  date: string;
  categoryId: string;
  note?: string;
  /** Amount and currency as written on the rule */
  amount: number;
  currency: string;
  /** Amount in home currency cents, or null when no rate is available */
  homeCents: number | null;
  /** Due date already passed and still unposted */
  isOverdue: boolean;
}

export interface BillReserveResult {
  /** Every unposted expense occurrence in the cycle, earliest first */
  bills: ReservedBill[];
  /** Sum of the bills that could be converted to home currency */
  reservedCents: number;
  /** Portion of reservedCents already past its due date */
  overdueCents: number;
  /** Portion of reservedCents still ahead */
  upcomingCents: number;
  /** Bills left out of the total because no rate was available */
  unconvertedCount: number;
}

export const EMPTY_BILL_RESERVE: BillReserveResult = {
  bills: [],
  reservedCents: 0,
  overdueCents: 0,
  upcomingCents: 0,
  unconvertedCount: 0,
};

/**
 * Works out how much of the remaining budget is already committed to scheduled bills.
 *
 * A bill counts towards the reserve when all of the following hold:
 * - its rule is active and is an expense (future income is never counted as available),
 * - the occurrence falls inside the active cycle,
 * - the occurrence has not been posted or skipped.
 *
 * The posted/skipped check is what keeps a bill from being counted twice: once it is
 * posted it becomes an ordinary entry inside `periodExpenses`, and its occurrence is
 * recorded, so it drops out of the reserve on the same tick it enters the spend total.
 *
 * Bills whose currency cannot be converted are returned in `bills` but left out of
 * `reservedCents`, so the figure on screen is never a guess.
 */
export function computeBillReserve(params: {
  rules: RecurringRule[];
  occurrences: Map<string, RecurringOccurrence>;
  period: BudgetPeriod;
  today: string;
  homeCurrency: string;
  /** Returns a rate from the given currency to home, or null when unknown */
  getRate: (currency: string) => number | null;
}): BillReserveResult {
  const { rules, occurrences, period, today, homeCurrency, getRate } = params;

  const bills: ReservedBill[] = [];
  const home = homeCurrency.toUpperCase();

  for (const rule of rules) {
    if (!rule.active) continue;
    if (rule.type !== 'expense') continue;

    const dates = generateAllOccurrences(rule, period.endDate);

    for (const date of dates) {
      if (date < period.startDate || date > period.endDate) continue;
      if (occurrences.has(`${rule.id}_${date}`)) continue;

      const currency = rule.currency.toUpperCase();
      let homeCents: number | null;

      if (currency === home) {
        homeCents = rule.amount;
      } else {
        const rate = getRate(rule.currency);
        homeCents = rate && rate > 0 ? calculateHomeAmountCents(rule.amount, rate) : null;
      }

      bills.push({
        ruleId: rule.id,
        date,
        categoryId: rule.categoryId,
        note: rule.note,
        amount: rule.amount,
        currency: rule.currency,
        homeCents,
        isOverdue: date < today,
      });
    }
  }

  bills.sort((a, b) => (a.date === b.date ? a.ruleId.localeCompare(b.ruleId) : a.date.localeCompare(b.date)));

  let reservedCents = 0;
  let overdueCents = 0;
  let upcomingCents = 0;
  let unconvertedCount = 0;

  for (const bill of bills) {
    if (bill.homeCents === null) {
      unconvertedCount += 1;
      continue;
    }
    reservedCents += bill.homeCents;
    if (bill.isOverdue) {
      overdueCents += bill.homeCents;
    } else {
      upcomingCents += bill.homeCents;
    }
  }

  return { bills, reservedCents, overdueCents, upcomingCents, unconvertedCount };
}
