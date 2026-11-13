/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RateStatus } from '../types/finance';
import { isFrankfurterSupported } from './currency';

const FRANKFURTER_BASE_URL = 'https://api.frankfurter.dev/v1';
const OPEN_ER_API_BASE_URL = 'https://open.er-api.com/v6/latest';

const RATE_CACHE_KEY = 'myfinances_cached_exchange_rates';

interface RateCacheItem {
  rate: number;
  timestamp: number;
  date: string;
}

function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Reads local cached rates from localStorage for offline estimation
 */
function getRateCache(): Record<string, RateCacheItem> {
  try {
    const raw = localStorage.getItem(RATE_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Saves a rate to localStorage cache
 */
function setRateCache(from: string, to: string, rate: number, date: string) {
  try {
    const cache = getRateCache();
    cache[`${from.toUpperCase()}_${to.toUpperCase()}`] = {
      rate,
      timestamp: Date.now(),
      date,
    };
    localStorage.setItem(RATE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors
  }
}

export interface RateResult {
  rate: number;
  rateStatus: RateStatus;
  source: string;
}

/**
 * Fetches the exchange rate between `fromCurrency` and `toCurrency`.
 * 1. If from === to, returns 1.0 with status 'fetched'.
 * 2. If both currencies are supported by Frankfurter, queries Frankfurter by date.
 * 3. Fallback to open.er-api.com (160+ currencies):
 *    - For entries dated today, sets rateStatus: 'fetched' (source: 'ExchangeRate-API').
 *    - For entries older than today, sets rateStatus: 'estimated' (source: 'ExchangeRate-API').
 * 4. Fallback to cached rate if available (rateStatus: 'estimated', source: 'Cache').
 * 5. Otherwise returns rate 0 with status 'pending' (source: 'Pending').
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  dateStr?: string
): Promise<RateResult> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  if (from === to) {
    return {
      rate: 1.0,
      rateStatus: 'fetched',
      source: 'Direct (1:1)',
    };
  }

  const todayKey = getTodayDateKey();
  const queryDate = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : todayKey;
  const isToday = queryDate === todayKey;

  // 1. Try Frankfurter if both currencies are in the ECB/Frankfurter dataset
  if (isFrankfurterSupported(from) && isFrankfurterSupported(to)) {
    try {
      const url = `${FRANKFURTER_BASE_URL}/${queryDate}?base=${from}&symbols=${to}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const rate = data.rates?.[to];
        if (typeof rate === 'number' && rate > 0) {
          setRateCache(from, to, rate, data.date || queryDate);
          return {
            rate,
            rateStatus: 'fetched',
            source: 'Frankfurter',
          };
        }
      }
    } catch {
      // Frankfurter network error, fallback to open.er-api.com
    }
  }

  // 2. Fallback to open.er-api.com (keyless, covers 160+ currencies)
  try {
    const url = `${OPEN_ER_API_BASE_URL}/${from}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.result === 'success' && data.rates) {
        const rate = data.rates[to];
        if (typeof rate === 'number' && rate > 0) {
          setRateCache(from, to, rate, todayKey);
          return {
            rate,
            // For entries dated today, mark 'fetched'; for older entries, mark 'estimated'
            rateStatus: isToday ? 'fetched' : 'estimated',
            source: 'ExchangeRate-API',
          };
        }
      }
    }
  } catch {
    // Offline or network error
  }

  // 3. Fallback to cached rate if available
  const cache = getRateCache();
  const cached = cache[`${from}_${to}`];
  if (cached && cached.rate > 0) {
    return {
      rate: cached.rate,
      rateStatus: 'estimated', // Rate came from cache, marked estimated
      source: 'Cache',
    };
  }

  // 4. No rate available (offline and un-cached) -> 'pending'
  return {
    rate: 0,
    rateStatus: 'pending',
    source: 'Pending',
  };
}

/**
 * Converts an amount in integer cents from original currency to home currency.
 * homeAmount = Math.round(amount * rate)
 */
export function calculateHomeAmountCents(amountCents: number, rate: number): number {
  if (rate <= 0) return 0;
  return Math.round(amountCents * rate);
}
