/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const APP_LOCALE = 'en-US';

export const CHART_COLOR_PALETTE = [
  '#FFB020', // Amber
  '#E8761A', // Ember
  '#4FD1A1', // Mint
  '#C9A86A', // Sand amber
  '#8FA67A', // Olive sage
  '#D9826B', // Coral
  '#A8A29E', // Warm stone
  '#7FA8A0', // Warm sage
];

export interface CurrencyConfig {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
}

/**
 * Fallback currency list including the original 12 plus GTQ (Guatemalan Quetzal)
 * and popular regional currencies, used if offline and cache is empty.
 */
export const FALLBACK_CURRENCIES: string[] = [
  'MXN',
  'USD',
  'EUR',
  'CAD',
  'GBP',
  'COP',
  'ARS',
  'BRL',
  'CLP',
  'JPY',
  'AUD',
  'CHF',
  'GTQ',
];

const CURRENCY_LIST_CACHE_KEY = 'myfinances_cached_currency_list';
const FRANKFURTER_CURRENCIES_KEY = 'myfinances_cached_frankfurter_currencies';

/**
 * Derives a human-friendly currency name using Intl.DisplayNames with fixed 'en-US' locale,
 * falling back to the uppercase ISO code.
 */
export function getCurrencyName(code: string): string {
  const upper = (code || 'USD').toUpperCase();
  try {
    const dn = new Intl.DisplayNames([APP_LOCALE], { type: 'currency' });
    const name = dn.of(upper);
    if (name && name !== upper) return name;
  } catch {
    // Ignore Intl errors
  }
  return upper;
}

/**
 * Derives the exact currency symbol using Intl.NumberFormat with currencyDisplay: 'symbol'
 * under fixed 'en-US' locale. (MXN shows 'MX$', EUR shows '€', GTQ shows 'GTQ', USD shows '$').
 */
export function getCurrencySymbol(code: string): string {
  const upper = (code || 'USD').toUpperCase();
  try {
    const formatter = new Intl.NumberFormat(APP_LOCALE, {
      style: 'currency',
      currency: upper,
      currencyDisplay: 'symbol',
    });
    const parts = formatter.formatToParts(0);
    const sym = parts.find((p) => p.type === 'currency');
    if (sym && sym.value) return sym.value;
  } catch {
    // Fall back to standard style or ISO code
  }
  return upper;
}

/**
 * Resolves standard decimal digits for a currency code (e.g. 0 for JPY/CLP, 2 for most).
 */
export function getCurrencyDecimals(code: string): number {
  const upper = (code || 'USD').toUpperCase();
  try {
    const res = new Intl.NumberFormat(APP_LOCALE, {
      style: 'currency',
      currency: upper,
    }).resolvedOptions();
    return res.maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/**
 * Assembles full CurrencyConfig with name and symbol derived from Intl.
 */
export function getCurrencyConfig(code: string): CurrencyConfig {
  const upper = (code || 'USD').toUpperCase();
  return {
    code: upper,
    name: getCurrencyName(upper),
    symbol: getCurrencySymbol(upper),
    decimals: getCurrencyDecimals(upper),
  };
}

/**
 * Formats integer cents into a localized string with symbol and proper decimals using
 * Intl.NumberFormat ('en-US', currencyDisplay: 'symbol').
 * - Mexican Peso shows as "MX$"
 * - Euro shows as "€" before the amount
 * - Currencies without a symbol show their ISO code (e.g. "GTQ 400.00")
 * - Never shows a bare "$" for anything except USD.
 */
export function formatCents(
  cents: number,
  currencyCode: string = 'USD',
  options: {
    showSign?: boolean;
    abs?: boolean;
    forceDecimals?: boolean;
    dropZeroDecimals?: boolean;
  } = {}
): string {
  const code = (currencyCode || 'USD').toUpperCase();
  const decimals = getCurrencyDecimals(code);
  const targetCents = options.abs ? Math.abs(cents) : cents;
  const isPositive = targetCents > 0;

  const decimalValue = targetCents / (decimals === 0 ? 1 : 100);

  // Universal rule: whole amounts show no decimals ("MX$450"),
  // amounts with cents show two decimals ("MX$2,049.12").
  const isWhole = Math.abs(cents) % 100 === 0;
  const shouldDropZero = !options.forceDecimals && isWhole;
  const minDecimals = shouldDropZero ? 0 : decimals;
  const maxDecimals = shouldDropZero ? 0 : decimals;

  let formatted = '';
  try {
    formatted = new Intl.NumberFormat(APP_LOCALE, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'symbol',
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
    }).format(decimalValue);
  } catch {
    formatted = `${code} ${minDecimals === 0 ? Math.round(decimalValue) : decimalValue.toFixed(decimals)}`;
  }

  if (options.showSign && isPositive) {
    return `+${formatted}`;
  }
  return formatted;
}

export function decimalStringToCents(val: string): number {
  if (!val || val.trim() === '') return 0;
  const clean = val.replace(',', '.').replace(/[^0-9.]/g, '');
  const parsed = parseFloat(clean);
  if (isNaN(parsed) || !isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

export function centsToDecimalString(cents: number, decimals: number = 2): string {
  if (decimals === 0) return Math.round(cents).toString();
  return (cents / 100).toFixed(decimals);
}

/**
 * Formats a YYYY-MM-DD date string consistently in English with fixed 'en-US' locale,
 * for example "Tue, 10 Nov".
 */
export function formatTransactionDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, (m || 1) - 1, d || 1);
  const weekday = dateObj.toLocaleDateString(APP_LOCALE, { weekday: 'short' });
  const month = dateObj.toLocaleDateString(APP_LOCALE, { month: 'short' });
  const day = dateObj.getDate();
  return `${weekday}, ${day} ${month}`;
}

/* -------------------- Provider Currency Fetching & Caching -------------------- */

/**
 * Reads locally cached currencies list from localStorage.
 */
export function getCachedCurrencies(): string[] {
  try {
    const raw = localStorage.getItem(CURRENCY_LIST_CACHE_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    }
  } catch {
    // Ignore cache parse errors
  }
  return FALLBACK_CURRENCIES;
}

/**
 * Checks whether Frankfurter supports a given currency code.
 */
export function isFrankfurterSupported(code: string): boolean {
  try {
    const raw = localStorage.getItem(FRANKFURTER_CURRENCIES_KEY);
    if (raw) {
      const set = JSON.parse(raw);
      if (Array.isArray(set)) {
        return set.includes(code.toUpperCase());
      }
    }
  } catch {
    // Ignore
  }
  // Default ECB currencies if not cached yet
  const defaultECB = [
    'AUD', 'BGN', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP',
    'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR',
    'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR'
  ];
  return defaultECB.includes(code.toUpperCase());
}

/**
 * Loads and merges the currency lists from both Frankfurter and open.er-api.com.
 * Caches the merged list and Frankfurter's set in localStorage for offline usage.
 * Falls back to FALLBACK_CURRENCIES if both are unreachable.
 */
export async function loadAndCacheSupportedCurrencies(): Promise<string[]> {
  const frankfurterPromise = (async () => {
    try {
      const res = await fetch('https://api.frankfurter.dev/v1/currencies', {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        return Object.keys(data).map((c) => c.toUpperCase());
      }
    } catch {
      // Frankfurter unavailable
    }
    return [] as string[];
  })();

  const erApiPromise = (async () => {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.rates && typeof data.rates === 'object') {
          return Object.keys(data.rates).map((c) => c.toUpperCase());
        }
      }
    } catch {
      // open.er-api unavailable
    }
    return [] as string[];
  })();

  const [frankfurterCodes, erApiCodes] = await Promise.all([frankfurterPromise, erApiPromise]);

  if (frankfurterCodes.length > 0) {
    try {
      localStorage.setItem(FRANKFURTER_CURRENCIES_KEY, JSON.stringify(frankfurterCodes));
    } catch {
      // Ignore
    }
  }

  // Merge unique currency codes
  const mergedSet = new Set<string>([
    ...FALLBACK_CURRENCIES,
    ...frankfurterCodes,
    ...erApiCodes,
  ]);

  // Filter valid 3-letter uppercase codes
  const validCodes = Array.from(mergedSet)
    .filter((c) => /^[A-Z]{3}$/.test(c))
    .sort();

  if (validCodes.length > 0) {
    try {
      localStorage.setItem(CURRENCY_LIST_CACHE_KEY, JSON.stringify(validCodes));
    } catch {
      // Ignore
    }
    return validCodes;
  }

  return getCachedCurrencies();
}
