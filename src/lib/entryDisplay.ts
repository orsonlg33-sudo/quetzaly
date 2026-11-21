/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Category, FinanceEntry } from '../types/finance';
import {
  APP_LOCALE,
  formatCodeAmount,
  formatExchangeRate,
} from './currency';
import { parseDateKey } from './periodMath';

export interface HistoryRowPresentation {
  title: string;
  secondaryContext?: string; // category name when title comes from note
  conversionLine?: string;   // e.g. "MXN 450.00 · GBP 18.00" (foreign only)
  primaryAmountText: string; // right-hand amount with explicit ISO code & + sign for income
  isForeign: boolean;
  isIncome: boolean;
  isPendingRate: boolean;
}

export interface EntryDetailPresentation {
  isForeign: boolean;
  isIncome: boolean;
  isPendingRate: boolean;
  headlineAmountText: string;     // Home currency amount (or pending label)
  originalAmountText: string;     // Original purchase amount with ISO code
  homeEquivalentText: string;     // Home equivalent amount with ISO code
  rateDirectionText?: string;     // e.g. "1 MXN = 0.0400 GBP"
  rateDateText?: string;          // Formatted rate date or "Rate date unavailable"
  rateSourceText?: string;        // Provider vs Manual or "Source unavailable"
}

export function formatCalendarDateFull(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || '';
  const dateObj = parseDateKey(dateStr);
  return dateObj.toLocaleDateString(APP_LOCALE, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Derives display fields for a History / Home transaction row from saved entry values.
 */
export function buildHistoryRowPresentation(
  entry: FinanceEntry,
  category: Category,
  homeCurrency: string
): HistoryRowPresentation {
  const normalizedHome = (homeCurrency || 'USD').toUpperCase();
  const normalizedEntryCurr = (entry.currency || normalizedHome).toUpperCase();
  const isForeign = normalizedEntryCurr !== normalizedHome;
  const isIncome = entry.type === 'income';
  const isPendingRate =
    isForeign && entry.rateStatus === 'pending' && (!entry.homeAmount || entry.homeAmount <= 0);

  const trimmedNote = entry.note?.trim();
  const title = trimmedNote || category.name;
  const secondaryContext = trimmedNote ? category.name : undefined;

  const homeCents = entry.homeAmount ?? entry.amount ?? 0;

  if (isForeign) {
    const originalFormatted = formatCodeAmount(entry.amount, normalizedEntryCurr);
    const homeFormatted = isPendingRate
      ? 'Rate pending'
      : formatCodeAmount(homeCents, normalizedHome);
    const primaryAmountText = isPendingRate
      ? originalFormatted
      : formatCodeAmount(homeCents, normalizedHome, { showSign: isIncome });

    return {
      title,
      secondaryContext,
      conversionLine: `${originalFormatted} · ${homeFormatted}`,
      primaryAmountText,
      isForeign: true,
      isIncome,
      isPendingRate,
    };
  }

  return {
    title,
    secondaryContext,
    primaryAmountText: formatCodeAmount(entry.amount, normalizedEntryCurr, { showSign: isIncome }),
    isForeign: false,
    isIncome,
    isPendingRate: false,
  };
}

/**
 * Derives display fields for the Transaction Detail sheet/dialog.
 * Never fabricates missing rateDate or rateSource metadata.
 */
export function buildEntryDetailPresentation(
  entry: FinanceEntry,
  homeCurrency: string
): EntryDetailPresentation {
  const normalizedHome = (homeCurrency || 'USD').toUpperCase();
  const normalizedEntryCurr = (entry.currency || normalizedHome).toUpperCase();
  const isForeign = normalizedEntryCurr !== normalizedHome;
  const isIncome = entry.type === 'income';
  const isPendingRate =
    isForeign && entry.rateStatus === 'pending' && (!entry.homeAmount || entry.homeAmount <= 0);

  const originalAmountText = formatCodeAmount(entry.amount, normalizedEntryCurr, {
    showSign: isIncome,
  });

  if (!isForeign) {
    return {
      isForeign: false,
      isIncome,
      isPendingRate: false,
      headlineAmountText: originalAmountText,
      originalAmountText,
      homeEquivalentText: originalAmountText,
    };
  }

  const homeCents = entry.homeAmount ?? entry.amount ?? 0;
  const homeEquivalentText = isPendingRate
    ? 'Pending exchange rate'
    : formatCodeAmount(homeCents, normalizedHome, { showSign: isIncome });

  const rateDirectionText =
    entry.rate > 0
      ? `1 ${normalizedEntryCurr} = ${formatExchangeRate(entry.rate)} ${normalizedHome}`
      : 'Rate pending';

  const rateDateText = entry.rateDate
    ? formatCalendarDateFull(entry.rateDate)
    : 'Rate date unavailable';

  let rateSourceText = 'Source unavailable';
  if (entry.rateSource && entry.rateSource.trim().length > 0) {
    const src = entry.rateSource.trim();
    if (src === 'Manual') {
      rateSourceText = 'Manually entered rate';
    } else if (src === 'Cache') {
      rateSourceText = 'Provider rate (cached)';
    } else if (src === 'Quetzaly Sample Rates') {
      rateSourceText = 'Fixed sample rate';
    } else {
      rateSourceText = `Provider rate (${src})`;
    }
  }

  return {
    isForeign: true,
    isIncome,
    isPendingRate,
    headlineAmountText: isPendingRate ? originalAmountText : homeEquivalentText,
    originalAmountText,
    homeEquivalentText,
    rateDirectionText,
    rateDateText,
    rateSourceText,
  };
}
