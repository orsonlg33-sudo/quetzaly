/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BudgetLimit, Category, BudgetPeriod, UserSettings } from '../types/finance';
import { getCurrencySymbol, decimalStringToCents, centsToDecimalString } from '../lib/currency';
import { AdaptiveModal, AdaptiveModalActions } from './AdaptiveModal';

interface BudgetLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePeriod: BudgetPeriod;
  categories: Category[];
  limits: BudgetLimit[];
  settings: UserSettings;
  onSaveLimit: (limit: BudgetLimit) => Promise<void>;
  onDeleteLimit: (limitId: string) => Promise<void>;
  initialType?: 'overall' | 'category';
  initialCategoryId?: string;
}

export const BudgetLimitModal: React.FC<BudgetLimitModalProps> = ({
  isOpen,
  onClose,
  activePeriod,
  categories,
  limits,
  settings,
  onSaveLimit,
  onDeleteLimit,
  initialType = 'overall',
  initialCategoryId,
}) => {
  const [limitType, setLimitType] = useState<'overall' | 'category'>(initialType);
  const [selectedCatId, setSelectedCatId] = useState<string>(initialCategoryId || '');
  const [isPeriodOverride, setIsPeriodOverride] = useState<boolean>(false);
  const [amountStr, setAmountStr] = useState<string>('');

  const currency = settings.homeCurrency;
  const currencySymbol = getCurrencySymbol(currency);
  const expenseCategories = categories.filter((c) => c.type === 'expense' && !c.isArchived);

  // Find existing matching limit
  const currentMatchingLimit = limits.find((l) => {
    if (limitType === 'overall') {
      return isPeriodOverride ? l.type === 'overall' && l.periodId === activePeriod.id : l.type === 'overall' && !l.periodId;
    } else {
      if (!selectedCatId) return false;
      return isPeriodOverride
        ? l.type === 'category' && l.categoryId === selectedCatId && l.periodId === activePeriod.id
        : l.type === 'category' && l.categoryId === selectedCatId && !l.periodId;
    }
  });

  // Categories without an existing limit
  const availableCategories = expenseCategories.filter(
    (c) => !limits.some((l) => l.type === 'category' && l.categoryId === c.id)
  );

  useEffect(() => {
    if (isOpen) {
      setLimitType(initialType);
      const defaultCatId = initialCategoryId || availableCategories[0]?.id || expenseCategories[0]?.id || '';
      setSelectedCatId(defaultCatId);
      setIsPeriodOverride(false);
    }
  }, [isOpen, initialType, initialCategoryId, availableCategories, expenseCategories]);

  useEffect(() => {
    if (currentMatchingLimit) {
      setAmountStr(centsToDecimalString(currentMatchingLimit.amount));
    } else {
      setAmountStr('');
    }
  }, [limitType, selectedCatId, isPeriodOverride, currentMatchingLimit]);

  if (!isOpen) return null;

  const currentCategory = categories.find((c) => c.id === selectedCatId);

  const handleSave = async () => {
    const cents = decimalStringToCents(amountStr);
    if (cents <= 0) return;
    if (limitType === 'category' && !selectedCatId) return;

    const now = Date.now();
    const targetLimit: BudgetLimit = {
      id: currentMatchingLimit?.id || `limit_${now}_${Math.random().toString(36).substring(2, 6)}`,
      type: limitType,
      categoryId: limitType === 'category' ? selectedCatId : undefined,
      periodId: isPeriodOverride ? activePeriod.id : undefined,
      amount: cents,
      createdAt: currentMatchingLimit?.createdAt || now,
      updatedAt: now,
    };

    await onSaveLimit(targetLimit);
    onClose();
  };

  const handleDelete = async () => {
    if (!currentMatchingLimit) return;
    await onDeleteLimit(currentMatchingLimit.id);
    onClose();
  };

  return (
    <AdaptiveModal
      id="budget_limit_modal"
      isOpen={isOpen}
      onClose={onClose}
    >
      {/* Scrollable sheet body */}
      <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
          {/* Header Title */}
          <div>
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
              {currentMatchingLimit ? (
                limitType === 'overall' ? 'Editing · Overall' : `Editing · ${currentCategory?.name || 'Category'}`
              ) : (
                limitType === 'overall' ? 'New limit · Overall' : 'New limit · By category'
              )}
            </span>

            {/* When editing an existing category limit, show category as title (emoji + name), not chips */}
            {currentMatchingLimit && limitType === 'category' && currentCategory && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xl">{currentCategory.emoji}</span>
                <span className="text-base font-bold text-[var(--text-primary)]">
                  {currentCategory.name}
                </span>
              </div>
            )}

            {/* Amount input: Plus Jakarta Sans 600, symbol "MX$", text inputMode="decimal", no spinners */}
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-2xl font-semibold text-[var(--text-primary)]">
                {currencySymbol}
              </span>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*"
                value={amountStr}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^0-9.]/g, '');
                  setAmountStr(clean);
                }}
                placeholder="0"
                className="w-full text-4xl font-semibold tracking-tight text-[var(--text-primary)] bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                autoFocus
              />
            </div>
          </div>

          {/* Show wrapped category chips ONLY when adding a new category limit (categories with existing limits hidden) */}
          {limitType === 'category' && !currentMatchingLimit && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">Category</label>
              {availableCategories.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {availableCategories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCatId(c.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-full border cursor-pointer transition-all inline-flex items-center gap-1.5 ${
                        selectedCatId === c.id
                          ? 'bg-[var(--accent)] text-black border-[var(--accent)] shadow-sm'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]/80'
                      }`}
                    >
                      <span>{c.emoji}</span>
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-secondary)] py-1">
                  All categories already have a budget limit configured.
                </p>
              )}
            </div>
          )}

          {/* Switch: Every cycle / This cycle only */}
          <div className="flex items-center bg-[var(--bg-elevated)] p-1 rounded-full w-fit">
            <button
              type="button"
              onClick={() => setIsPeriodOverride(false)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                !isPeriodOverride
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Every cycle
            </button>
            <button
              type="button"
              onClick={() => setIsPeriodOverride(true)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                isPeriodOverride
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              This cycle only
            </button>
          </div>
        </div>

        {/* Bottom Actions: Remove limit text button above Save (only when limit exists) */}
        <AdaptiveModalActions>
          {currentMatchingLimit && (
            <div className="text-center">
              <button
                type="button"
                onClick={handleDelete}
                className="text-xs font-semibold text-[var(--danger)] hover:underline cursor-pointer"
              >
                Remove limit
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            className="w-full py-3.5 text-xs font-semibold rounded-2xl bg-[var(--accent)] text-black hover:opacity-90 transition-all cursor-pointer shadow-sm"
          >
            Save
          </button>
        </AdaptiveModalActions>
      </AdaptiveModal>
  );
};
