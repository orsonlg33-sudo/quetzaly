/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, ChevronDown, Calendar, Info } from 'lucide-react';
import { RecurringRule, RecurringFrequency, Category, UserSettings } from '../types/finance';
import { AdaptiveModal, AdaptiveModalActions } from './AdaptiveModal';
import { CurrencyPickerSheet } from './CurrencyPickerSheet';
import { CustomDatePickerModal, formatFullDate } from './CustomDatePickerModal';
import { getCurrencySymbol, getCurrencyConfig, decimalStringToCents } from '../lib/currency';
import { getTodayDateString, parseDate, getOrdinal, getScheduleSummaryText } from '../lib/recurringMath';

interface RecurringModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingRule?: RecurringRule | null;
  initialData?: Partial<RecurringRule>;
  categories: Category[];
  settings: UserSettings;
  onSave: (rule: Partial<RecurringRule>) => Promise<void>;
  onDelete?: (ruleId: string) => Promise<void>;
}

export const RecurringModal: React.FC<RecurringModalProps> = ({
  isOpen,
  onClose,
  editingRule,
  initialData,
  categories,
  settings,
  onSave,
  onDelete,
}) => {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amountStr, setAmountStr] = useState<string>('');
  const [currency, setCurrency] = useState<string>(settings.homeCurrency);
  const [categoryId, setCategoryId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [monthlyDay, setMonthlyDay] = useState<number>(1);
  const [startDate, setStartDate] = useState<string>(getTodayDateString());
  const [hasEndDate, setHasEndDate] = useState<boolean>(false);
  const [endDate, setEndDate] = useState<string>('');
  const [autoAdd, setAutoAdd] = useState<boolean>(false);
  const [active, setActive] = useState<boolean>(true);

  const [isCurrencyPickerOpen, setIsCurrencyPickerOpen] = useState<boolean>(false);
  const [activeDatePicker, setActiveDatePicker] = useState<'start' | 'end' | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Initialize form state
  useEffect(() => {
    if (!isOpen) return;

    if (editingRule) {
      setType(editingRule.type);
      setAmountStr(editingRule.amount ? (editingRule.amount / 100).toString() : '');
      setCurrency(editingRule.currency);
      setCategoryId(editingRule.categoryId);
      setNote(editingRule.note || '');
      setFrequency(editingRule.frequency);
      setMonthlyDay(editingRule.monthlyDay ?? parseDate(editingRule.startDate).day);
      setStartDate(editingRule.startDate);
      setHasEndDate(Boolean(editingRule.endDate));
      setEndDate(editingRule.endDate || '');
      setAutoAdd(Boolean(editingRule.autoAdd));
      setActive(editingRule.active !== false);
    } else {
      const today = getTodayDateString();
      const todayDay = parseDate(today).day;

      setType(initialData?.type || 'expense');
      setAmountStr(initialData?.amount ? (initialData.amount / 100).toString() : '');
      setCurrency(initialData?.currency || settings.homeCurrency);
      setCategoryId(initialData?.categoryId || '');
      setNote(initialData?.note || '');
      setFrequency(initialData?.frequency || 'monthly');
      setMonthlyDay(initialData?.monthlyDay ?? todayDay);
      setStartDate(initialData?.startDate || today);
      setHasEndDate(Boolean(initialData?.endDate));
      setEndDate(initialData?.endDate || '');
      setAutoAdd(Boolean(initialData?.autoAdd ?? false));
      setActive(initialData?.active !== false);
    }
  }, [isOpen, editingRule, initialData, settings.homeCurrency]);

  const filteredCategories = categories.filter((c) => c.type === type && !c.isArchived);

  // Default category if none selected
  useEffect(() => {
    if (filteredCategories.length > 0 && !filteredCategories.some((c) => c.id === categoryId)) {
      setCategoryId(filteredCategories[0].id);
    }
  }, [type, filteredCategories, categoryId]);

  const handleSave = async () => {
    const cents = decimalStringToCents(amountStr);
    if (cents <= 0) return;

    setIsSaving(true);
    try {
      await onSave({
        id: editingRule?.id,
        type,
        amount: cents,
        currency,
        categoryId: categoryId || filteredCategories[0]?.id || 'cat_other_exp',
        note: note.trim() || undefined,
        frequency,
        monthlyDay: parseDate(startDate).day,
        startDate,
        endDate: hasEndDate && endDate ? endDate : undefined,
        autoAdd,
        active,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingRule || !onDelete) return;
    setIsSaving(true);
    try {
      await onDelete(editingRule.id);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const currencySymbol = getCurrencySymbol(currency);
  const isValidAmount = decimalStringToCents(amountStr) > 0;

  // Format amount input for visual display with thousands separators
  const formatAmountDisplay = (raw: string) => {
    if (!raw) return '';
    const parts = raw.split('.');
    const integerPart = parts[0] ? Number(parts[0]).toLocaleString('en-US') : '';
    if (parts.length > 1) {
      return `${integerPart}.${parts[1]}`;
    }
    return integerPart;
  };

  return (
    <>
      <AdaptiveModal
        id="recurring_rule_modal"
        isOpen={isOpen}
        onClose={onClose}
        maxWidthClass="max-w-[520px]"
      >
        {/* Header */}
        <div className="p-6 pb-2 border-b border-[var(--border-subtle)] shrink-0 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
              {editingRule ? 'Edit recurring entry' : 'New recurring entry'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
          {/* Amount input row (normal font with thousands separators, matching BudgetLimitModal) */}
          <div className="space-y-1">
            <span className="text-xs font-medium text-[var(--text-secondary)] block">
              Amount
            </span>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-1.5 flex-1 min-w-0">
                <span className="text-2xl font-semibold text-[var(--text-primary)] shrink-0">
                  {currencySymbol}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={amountStr}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, '');
                    setAmountStr(val);
                  }}
                  className="w-full text-4xl font-semibold tracking-tight text-[var(--text-primary)] bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none tabular-nums"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  autoFocus={!editingRule}
                />
              </div>

              <button
                type="button"
                onClick={() => setIsCurrencyPickerOpen(true)}
                className="px-3 py-1.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1 hover:bg-[var(--bg-elevated)]/80 cursor-pointer shrink-0"
              >
                <span>{currency}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              </button>
            </div>
          </div>

          {/* Type Toggle: Expense / Income */}
          <div className="flex items-center bg-[var(--bg-elevated)] p-1 rounded-full w-fit">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                type === 'expense'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                type === 'income'
                  ? 'bg-[var(--bg-surface)] text-[var(--income)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Income
            </button>
          </div>

          {/* Frequency */}
          <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]/50">
            <span className="text-xs font-medium text-[var(--text-secondary)] block">
              Frequency
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'weekly', label: 'Weekly' },
                  { id: 'biweekly', label: 'Every 2 weeks' },
                  { id: 'monthly', label: 'Monthly' },
                  { id: 'yearly', label: 'Yearly' },
                ] as const
              ).map((f) => {
                const isSelected = frequency === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFrequency(f.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center border ${
                      isSelected
                        ? 'bg-[var(--accent)] text-black border-[var(--accent)] shadow-sm'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Wrapped Chips */}
          <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]/50">
            <span className="text-xs font-medium text-[var(--text-secondary)] block">
              Category
            </span>
            <div className="flex flex-wrap gap-2">
              {filteredCategories.map((cat) => {
                const isSelected = categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[var(--accent)] text-black border-[var(--accent)] shadow-sm'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]/80'
                    }`}
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note Input */}
          <div className="space-y-1.5 pt-2 border-t border-[var(--border-subtle)]/50">
            <span className="text-xs font-medium text-[var(--text-secondary)] block">
              Note
            </span>
            <input
              type="text"
              placeholder="e.g. Rent, Netflix, Gym membership"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Schedule Dates: Starts on & Optional End Date buttons */}
          <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]/50">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Starts on
                </span>
                <button
                  type="button"
                  onClick={() => setActiveDatePicker('start')}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]/80 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>{formatFullDate(startDate)}</span>
                </button>
              </div>

              {/* Live grey line: "Repeats monthly on the 12th. Next: Dec 12." */}
              <p className="text-[11px] text-[var(--text-secondary)] pt-0.5">
                {getScheduleSummaryText(frequency, startDate, hasEndDate ? endDate : undefined)}
              </p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-medium text-[var(--text-secondary)] block">End date</span>
                <span className="text-[11px] text-[var(--text-secondary)] opacity-80">Rule stops repeating after this date</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!hasEndDate) {
                    setHasEndDate(true);
                    setEndDate(startDate);
                    setActiveDatePicker('end');
                  } else {
                    setHasEndDate(false);
                    setEndDate('');
                  }
                }}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  hasEndDate ? 'bg-[var(--accent)]' : 'bg-[var(--border-subtle)]'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    hasEndDate ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {hasEndDate && (
              <div className="flex items-center justify-between gap-4 pt-1">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Selected end date
                </span>
                <button
                  type="button"
                  onClick={() => setActiveDatePicker('end')}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]/80 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>{endDate ? formatFullDate(endDate) : 'Select end date'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Add Automatically Switch */}
          <div className="flex items-center justify-between py-2 border-t border-[var(--border-subtle)]/50">
            <div>
              <span className="text-xs font-medium text-[var(--text-primary)] block">Add automatically</span>
              <span className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Posts entries immediately on schedule without waiting for confirmation
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAutoAdd(!autoAdd)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ml-4 ${
                autoAdd ? 'bg-[var(--accent)]' : 'bg-[var(--border-subtle)]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  autoAdd ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Active / Paused Switch (when editing) */}
          {editingRule && (
            <div className="flex items-center justify-between py-2 border-t border-[var(--border-subtle)]/50">
              <div>
                <span className="text-xs font-medium text-[var(--text-primary)] block">Active status</span>
                <span className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  {active ? 'Rule is active and generating entries' : 'Rule is paused (no occurrences will be created)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActive(!active)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ml-4 ${
                  active ? 'bg-[var(--accent)]' : 'bg-[var(--border-subtle)]'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    active ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}
        </div>

        {/* Pinned Action Footer */}
        <AdaptiveModalActions className="space-y-2">
          {editingRule && onDelete && (
            <div className="text-center">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving}
                className="text-xs font-semibold text-[var(--danger)] hover:underline cursor-pointer"
              >
                Delete rule
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={!isValidAmount || isSaving}
            className="w-full py-3.5 text-xs font-semibold rounded-2xl bg-[var(--accent)] text-black dark:text-black shadow-sm disabled:opacity-40 cursor-pointer hover:opacity-90 transition-opacity"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </AdaptiveModalActions>
      </AdaptiveModal>

      {/* Currency Picker Sheet */}
      <CurrencyPickerSheet
        id="currency_picker_recurring"
        isOpen={isCurrencyPickerOpen}
        onClose={() => setIsCurrencyPickerOpen(false)}
        selectedCurrency={currency}
        homeCurrency={settings.homeCurrency}
        recentCurrencies={settings.recentCurrencies || []}
        onSelect={(code) => setCurrency(code)}
        title="Currency"
      />

      {/* Custom Date Picker Modal for Start Date */}
      <CustomDatePickerModal
        id="date_picker_recurring_start"
        isOpen={activeDatePicker === 'start'}
        onClose={() => setActiveDatePicker(null)}
        selectedDate={startDate}
        onSelectDate={(d) => {
          setStartDate(d);
          if (frequency === 'monthly') {
            setMonthlyDay(parseDate(d).day);
          }
          if (endDate && d > endDate) {
            setEndDate(d);
          }
        }}
        title="Select start date"
      />

      {/* Custom Date Picker Modal for End Date */}
      <CustomDatePickerModal
        id="date_picker_recurring_end"
        isOpen={activeDatePicker === 'end'}
        onClose={() => setActiveDatePicker(null)}
        selectedDate={endDate || startDate}
        minDate={startDate}
        showNoEndDate={true}
        onSelectNoEndDate={() => {
          setHasEndDate(false);
          setEndDate('');
        }}
        onSelectDate={(d) => {
          setHasEndDate(true);
          setEndDate(d);
        }}
        title="Select end date"
      />
    </>
  );
};
