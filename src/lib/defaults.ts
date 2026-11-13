/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Category, FinanceEntry, UserSettings } from '../types/finance';
import { formatDateKey } from './periodMath';

export const DEFAULT_SETTINGS: UserSettings = {
  homeCurrency: 'USD',
  monthStartDay: 1,
  rolloverEnabled: false,
  lastUsedCurrency: 'USD',
  hasDismissedSamplePrompt: false,
  themeMode: 'dark',
  hasSeenWelcome: false,
};

export const DEFAULT_CATEGORIES: Category[] = [
  // Expense categories (8 warm chart colors: #FFB020, #E8761A, #4FD1A1, #C9A86A, #8FA67A, #D9826B, #A8A29E, #7FA8A0)
  { id: 'cat_groceries', name: 'Food & Groceries', emoji: '🍕', color: '#E8761A', type: 'expense', isDefault: true, order: 1 },
  { id: 'cat_dining', name: 'Cafes & Dining', emoji: '☕', color: '#C9A86A', type: 'expense', isDefault: true, order: 2 },
  { id: 'cat_transit', name: 'Transit & Gas', emoji: '🚗', color: '#7FA8A0', type: 'expense', isDefault: true, order: 3 },
  { id: 'cat_housing', name: 'Home & Utilities', emoji: '🏠', color: '#8FA67A', type: 'expense', isDefault: true, order: 4 },
  { id: 'cat_shopping', name: 'Shopping & Gear', emoji: '🛍️', color: '#D9826B', type: 'expense', isDefault: true, order: 5 },
  { id: 'cat_leisure', name: 'Entertainment & Fun', emoji: '🍿', color: '#FFB020', type: 'expense', isDefault: true, order: 6 },
  { id: 'cat_health', name: 'Health & Pharmacy', emoji: '💊', color: '#4FD1A1', type: 'expense', isDefault: true, order: 7 },
  { id: 'cat_bills', name: 'Subscriptions & Bills', emoji: '📱', color: '#E8761A', type: 'expense', isDefault: true, order: 8 },
  { id: 'cat_other_exp', name: 'General & Misc', emoji: '📦', color: '#A8A29E', type: 'expense', isDefault: true, order: 9 },

  // Income categories
  { id: 'cat_salary', name: 'Salary & Wages', emoji: '💼', color: '#4FD1A1', type: 'income', isDefault: true, order: 1 },
  { id: 'cat_freelance', name: 'Side Projects & Freelance', emoji: '💻', color: '#8FA67A', type: 'income', isDefault: true, order: 2 },
  { id: 'cat_investments', name: 'Investments & Returns', emoji: '📈', color: '#7FA8A0', type: 'income', isDefault: true, order: 3 },
  { id: 'cat_gifts', name: 'Gifts & Refunds', emoji: '🎁', color: '#FFB020', type: 'income', isDefault: true, order: 4 },
  { id: 'cat_other_inc', name: 'Other Income', emoji: '💰', color: '#C9A86A', type: 'income', isDefault: true, order: 5 },
];

/**
 * Creates realistic sample entries for testing the dashboard, category charts,
 * period boundaries, and carried-over balances.
 * All entries are tagged with isSample: true so they can be identified and cleared in one tap.
 */
export function generateSampleEntries(homeCurrency: string = 'MXN', currentPeriodStartDate: string): FinanceEntry[] {
  const now = new Date();
  const todayKey = formatDateKey(now);

  const [startY, startM, startD] = currentPeriodStartDate.split('-').map(Number);
  const currentStart = new Date(startY, startM - 1, startD);

  // Previous cycle start is ~30 days prior
  const prevStart = new Date(currentStart.getTime() - 30 * 24 * 60 * 60 * 1000);

  const prevStartKey = formatDateKey(prevStart);
  const prevDay4Key = formatDateKey(new Date(prevStart.getTime() + 4 * 24 * 60 * 60 * 1000));
  const prevDay10Key = formatDateKey(new Date(prevStart.getTime() + 10 * 24 * 60 * 60 * 1000));
  const prevDay18Key = formatDateKey(new Date(prevStart.getTime() + 18 * 24 * 60 * 60 * 1000));
  const prevDay25Key = formatDateKey(new Date(prevStart.getTime() + 25 * 24 * 60 * 60 * 1000));

  const currDay2Key = formatDateKey(new Date(currentStart.getTime() + 2 * 24 * 60 * 60 * 1000));
  const currDay5Key = formatDateKey(new Date(currentStart.getTime() + 5 * 24 * 60 * 60 * 1000));
  const currDay8Key = formatDateKey(new Date(currentStart.getTime() + 8 * 24 * 60 * 60 * 1000));

  const sampleList: Array<Omit<FinanceEntry, 'id' | 'createdAt' | 'updatedAt'>> = [
    // --- PREVIOUS CYCLE SAMPLES ---
    {
      type: 'income',
      amount: 2000000, // 20,000.00
      currency: homeCurrency,
      homeAmount: 2000000,
      rate: 1.0,
      rateStatus: 'fetched',
      rateEditedManually: false,
      date: prevStartKey,
      categoryId: 'cat_salary',
      note: 'Previous cycle salary deposit',
      isSample: true,
    },
    {
      type: 'expense',
      amount: 85000, // 850.00
      currency: homeCurrency,
      homeAmount: 85000,
      rate: 1.0,
      rateStatus: 'fetched',
      rateEditedManually: false,
      date: prevDay4Key,
      categoryId: 'cat_groceries',
      note: 'Previous cycle fresh groceries',
      isSample: true,
    },
    {
      type: 'expense',
      amount: 32000, // 320.00
      currency: homeCurrency,
      homeAmount: 32000,
      rate: 1.0,
      rateStatus: 'fetched',
      rateEditedManually: false,
      date: prevDay10Key,
      categoryId: 'cat_transit',
      note: 'Metro card top-up & fuel',
      isSample: true,
    },
    {
      type: 'expense',
      amount: 2500, // $25.00 USD (Foreign currency entry 1)
      currency: 'USD',
      homeAmount: 52000, // 520.00 home
      rate: 20.8,
      rateStatus: 'fetched',
      rateEditedManually: false,
      date: prevDay18Key,
      categoryId: 'cat_bills',
      note: 'Cloud server subscription (USD)',
      isSample: true,
    },
    {
      type: 'expense',
      amount: 45000, // 450.00
      currency: homeCurrency,
      homeAmount: 45000,
      rate: 1.0,
      rateStatus: 'fetched',
      rateEditedManually: false,
      date: prevDay25Key,
      categoryId: 'cat_shopping',
      note: 'Home gear purchase',
      isSample: true,
    },

    // --- CURRENT CYCLE SAMPLES ---
    {
      type: 'income',
      amount: 2000000, // 20,000.00
      currency: homeCurrency,
      homeAmount: 2000000,
      rate: 1.0,
      rateStatus: 'fetched',
      rateEditedManually: false,
      date: currentPeriodStartDate,
      categoryId: 'cat_salary',
      note: 'Main salary deposit',
      isSample: true,
    },
    {
      type: 'expense',
      amount: 119000, // 1,190.00 (40% higher than last cycle groceries)
      currency: homeCurrency,
      homeAmount: 119000,
      rate: 1.0,
      rateStatus: 'fetched',
      rateEditedManually: false,
      date: currentPeriodStartDate,
      categoryId: 'cat_groceries',
      note: 'Weekly fresh market groceries',
      isSample: true,
    },
    {
      type: 'expense',
      amount: 15000, // 150.00
      currency: homeCurrency,
      homeAmount: 15000,
      rate: 1.0,
      rateStatus: 'fetched',
      rateEditedManually: false,
      date: currDay2Key,
      categoryId: 'cat_dining',
      note: 'Coffee & bakery morning catch-up',
      isSample: true,
    },
    {
      type: 'expense',
      amount: 28000, // 280.00
      currency: homeCurrency,
      homeAmount: 28000,
      rate: 1.0,
      rateStatus: 'fetched',
      rateEditedManually: false,
      date: currDay5Key,
      categoryId: 'cat_transit',
      note: 'Bus passes & transport',
      isSample: true,
    },
    {
      type: 'expense',
      amount: 1850, // €18.50 EUR (Foreign currency entry 2)
      currency: 'EUR',
      homeAmount: 38480, // 384.80 home at 20.80
      rate: 20.8,
      rateStatus: 'fetched',
      rateEditedManually: false,
      date: currDay8Key,
      categoryId: 'cat_bills',
      note: 'Domain registration (EUR)',
      isSample: true,
    },
    {
      type: 'expense',
      amount: 42000, // 420.00
      currency: homeCurrency,
      homeAmount: 42000,
      rate: 1.0,
      rateStatus: 'fetched',
      rateEditedManually: false,
      date: todayKey,
      categoryId: 'cat_leisure',
      note: 'Weekend book purchase & cinema',
      isSample: true,
    },
  ];

  const nowMs = Date.now();
  return sampleList.map((item, index) => ({
    ...item,
    id: `sample_entry_${index + 1}_${nowMs}`,
    createdAt: nowMs - index * 60000,
    updatedAt: nowMs - index * 60000,
  }));
}
