/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RecurringRule, RecurringOccurrence } from '../types/finance';

/**
 * Returns number of days in a given year and month (1-indexed month: 1=Jan, 2=Feb, ..., 12=Dec).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Parses YYYY-MM-DD into year, month (1-indexed), day.
 */
export function parseDate(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y, month: m, day: d };
}

/**
 * Formats year, month (1-indexed), day into YYYY-MM-DD.
 */
export function formatDate(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Adds N days to a YYYY-MM-DD date string using pure local arithmetic.
 */
export function addDays(dateStr: string, days: number): string {
  const { year, month, day } = parseDate(dateStr);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  return formatDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * Today's date in local YYYY-MM-DD format (no timezone shifting).
 */
export function getTodayDateString(): string {
  const now = new Date();
  return formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * Returns ordinal suffix for a number (1st, 2nd, 3rd, 4th, etc.)
 */
export function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Computes the occurrence date for a monthly rule in a specific month offset from start.
 * If monthlyDay is 29, 30, or 31, falls on the last day of shorter months.
 */
export function getMonthlyOccurrenceDate(
  startYear: number,
  startMonth: number,
  targetDay: number,
  monthOffset: number
): string {
  let targetYear = startYear;
  let targetMonth = startMonth + monthOffset;

  while (targetMonth > 12) {
    targetYear += 1;
    targetMonth -= 12;
  }
  while (targetMonth < 1) {
    targetYear -= 1;
    targetMonth += 12;
  }

  const daysInMonth = getDaysInMonth(targetYear, targetMonth);
  const clampedDay = Math.min(targetDay, daysInMonth);

  return formatDate(targetYear, targetMonth, clampedDay);
}

/**
 * Computes all occurrence dates for a rule up to `upToDate` (inclusive).
 * Dates are returned in chronological order.
 */
export function generateAllOccurrences(
  rule: RecurringRule,
  upToDate: string
): string[] {
  const occurrences: string[] = [];
  const start = rule.startDate;
  const maxDate = rule.endDate && rule.endDate < upToDate ? rule.endDate : upToDate;

  if (start > maxDate) {
    return occurrences;
  }

  const { year: startY, month: startM, day: startD } = parseDate(start);
  const targetDay = rule.monthlyDay ?? startD;

  switch (rule.frequency) {
    case 'weekly': {
      let current = start;
      while (current <= maxDate) {
        occurrences.push(current);
        current = addDays(current, 7);
      }
      break;
    }
    case 'biweekly': {
      let current = start;
      while (current <= maxDate) {
        occurrences.push(current);
        current = addDays(current, 14);
      }
      break;
    }
    case 'monthly': {
      let monthOffset = 0;
      while (true) {
        const occDate = getMonthlyOccurrenceDate(startY, startM, targetDay, monthOffset);
        if (occDate > maxDate) {
          break;
        }
        // If start date is after the computed date (e.g. if start was clamped differently), skip
        if (occDate >= start) {
          occurrences.push(occDate);
        }
        monthOffset += 1;
      }
      break;
    }
    case 'yearly': {
      let yearOffset = 0;
      while (true) {
        const targetYear = startY + yearOffset;
        const daysInMonth = getDaysInMonth(targetYear, startM);
        const clampedDay = Math.min(startD, daysInMonth);
        const occDate = formatDate(targetYear, startM, clampedDay);

        if (occDate > maxDate) {
          break;
        }
        if (occDate >= start) {
          occurrences.push(occDate);
        }
        yearOffset += 1;
      }
      break;
    }
  }

  return occurrences;
}

/**
 * Returns due occurrence dates that have not yet been posted or skipped.
 */
export function getPendingDueOccurrences(
  rule: RecurringRule,
  today: string,
  recordedOccurrences: Map<string, RecurringOccurrence>
): string[] {
  // Paused rules do not generate new occurrences
  if (!rule.active) {
    return [];
  }

  const all = generateAllOccurrences(rule, today);
  return all.filter((date) => {
    const key = `${rule.id}_${date}`;
    return !recordedOccurrences.has(key);
  });
}

/**
 * Computes the next scheduled occurrence strictly after referenceDate (usually today).
 * If the rule has an endDate and the next occurrence is after endDate, returns null.
 */
export function getNextOccurrenceDate(
  rule: RecurringRule,
  referenceDate: string = getTodayDateString()
): string | null {
  const { year: startY, month: startM, day: startD } = parseDate(rule.startDate);
  const targetDay = rule.monthlyDay ?? startD;

  let candidate: string | null = null;

  switch (rule.frequency) {
    case 'weekly': {
      let current = rule.startDate;
      while (current <= referenceDate) {
        current = addDays(current, 7);
      }
      candidate = current;
      break;
    }
    case 'biweekly': {
      let current = rule.startDate;
      while (current <= referenceDate) {
        current = addDays(current, 14);
      }
      candidate = current;
      break;
    }
    case 'monthly': {
      let offset = 0;
      while (true) {
        const d = getMonthlyOccurrenceDate(startY, startM, targetDay, offset);
        if (d > referenceDate && d >= rule.startDate) {
          candidate = d;
          break;
        }
        offset += 1;
        // Safeguard to prevent infinite loops
        if (offset > 1200) break;
      }
      break;
    }
    case 'yearly': {
      let offset = 0;
      while (true) {
        const y = startY + offset;
        const daysInMonth = getDaysInMonth(y, startM);
        const d = formatDate(y, startM, Math.min(startD, daysInMonth));
        if (d > referenceDate && d >= rule.startDate) {
          candidate = d;
          break;
        }
        offset += 1;
        if (offset > 100) break;
      }
      break;
    }
  }

  if (candidate && rule.endDate && candidate > rule.endDate) {
    return null;
  }

  return candidate;
}

/**
 * Human-readable frequency label: "Monthly on the 1st", "Weekly", "Every 2 weeks", "Yearly on Nov 12"
 */
export function formatFrequencySchedule(rule: RecurringRule): string {
  const { month, day } = parseDate(rule.startDate);
  const targetDay = rule.monthlyDay ?? day;

  switch (rule.frequency) {
    case 'weekly':
      return 'Weekly';
    case 'biweekly':
      return 'Every 2 weeks';
    case 'monthly':
      return `Monthly on the ${getOrdinal(targetDay)}`;
    case 'yearly': {
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      return `Yearly on ${monthNames[month - 1]} ${day}`;
    }
    default:
      return 'Repeats';
  }
}

/**
 * Formats a date string into "Dec 1" or "Nov 12, 2026"
 */
export function formatShortDate(dateStr: string, includeYear: boolean = false): string {
  const { year, month, day } = parseDate(dateStr);
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const name = monthNames[month - 1];
  return includeYear ? `${name} ${day}, ${year}` : `${name} ${day}`;
}

/**
 * Generates one live grey line summary text for a recurring schedule based on start date.
 * Example: "Repeats monthly on the 12th. Next: Dec 12."
 */
export function getScheduleSummaryText(
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'yearly',
  startDate: string,
  endDate?: string,
  referenceDate: string = getTodayDateString()
): string {
  if (!startDate) return '';

  const { year, month, day } = parseDate(startDate);
  const dateObj = new Date(year, month - 1, day);
  const weekdayLong = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const monthNamesShort = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const monthShort = monthNamesShort[month - 1];
  const ordinalDay = getOrdinal(day);

  let scheduleDesc = '';
  switch (frequency) {
    case 'weekly':
      scheduleDesc = `Repeats every ${weekdayLong}`;
      break;
    case 'biweekly':
      scheduleDesc = `Repeats every 2 weeks on ${weekdayLong}`;
      break;
    case 'monthly':
      scheduleDesc = `Repeats monthly on the ${ordinalDay}`;
      break;
    case 'yearly':
      scheduleDesc = `Repeats yearly on ${monthShort} ${day}`;
      break;
  }

  // Next occurrence
  let nextDateStr: string | null = null;
  if (startDate >= referenceDate) {
    nextDateStr = startDate;
  } else {
    const tempRule: RecurringRule = {
      id: 'temp',
      type: 'expense',
      amount: 0,
      currency: 'USD',
      categoryId: '',
      frequency,
      monthlyDay: day,
      startDate,
      endDate,
      active: true,
      autoAdd: false,
      createdAt: 0,
      updatedAt: 0,
    };
    nextDateStr = getNextOccurrenceDate(tempRule, referenceDate);
  }

  if (nextDateStr) {
    const isYearly = frequency === 'yearly';
    const nextFormatted = formatShortDate(nextDateStr, isYearly);
    return `${scheduleDesc}. Next: ${nextFormatted}.`;
  }

  return `${scheduleDesc}.`;
}
