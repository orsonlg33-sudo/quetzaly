/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeft, ChevronRight, Plus } from 'lucide-react';
import { BudgetLimit, Category, BudgetPeriod, UserSettings, FinanceEntry } from '../types/finance';
import { formatCents, getCurrencySymbol, decimalStringToCents } from '../lib/currency';
import { AdaptiveModal, AdaptiveModalActions } from './AdaptiveModal';

interface BudgetLimitsPageProps {
  onBack: () => void;
  activePeriod: BudgetPeriod;
  categories: Category[];
  limits: BudgetLimit[];
  settings: UserSettings;
  entries: FinanceEntry[];
  onSaveLimit: (limit: BudgetLimit) => Promise<void>;
  onDeleteLimit: (limitId: string) => Promise<void>;
}

export const BudgetLimitsPage: React.FC<BudgetLimitsPageProps> = ({
  onBack,
  activePeriod,
  categories,
  limits,
  settings,
  entries,
  onSaveLimit,
  onDeleteLimit,
}) => {
  // Editing state for small bottom sheet
  const [editingLimit, setEditingLimit] = useState<{
    id?: string;
    type: 'overall' | 'category';
    categoryId?: string;
    amountCents: number;
    isPeriodOverride: boolean;
  } | null>(null);

  const [amountStr, setAmountStr] = useState<string>('');

  const currency = settings.homeCurrency;
  const currencySymbol = getCurrencySymbol(currency);
  const expenseCategories = categories.filter((c) => c.type === 'expense' && !c.isArchived);

  // Overall limit calculation
  const overallLimit = limits.find((l) => l.type === 'overall');
  const periodExpenses = entries
    .filter((e) => e.date >= activePeriod.startDate && e.date <= activePeriod.endDate && e.type === 'expense')
    .reduce((sum, e) => sum + (e.homeAmount ?? e.amount ?? 0), 0);

  const overallSpent = periodExpenses;
  const overallLimitAmount = overallLimit ? overallLimit.amount : 0;
  const overallRemaining = overallLimitAmount - overallSpent;
  const overallPct = overallLimitAmount > 0 ? Math.min(100, Math.round((overallSpent / overallLimitAmount) * 100)) : 0;
  const isOverallOver = overallRemaining < 0;

  // Category limits
  const categoryLimits = limits.filter((l) => l.type === 'category');

  // Categories without an existing limit
  const availableCategories = expenseCategories.filter(
    (c) => !categoryLimits.some((l) => l.categoryId === c.id)
  );

  const openEditSheet = (
    type: 'overall' | 'category',
    categoryId?: string,
    existingLimit?: BudgetLimit
  ) => {
    setEditingLimit({
      id: existingLimit?.id,
      type,
      categoryId,
      amountCents: existingLimit?.amount || 0,
      isPeriodOverride: Boolean(existingLimit?.periodId),
    });
    setAmountStr(existingLimit ? (existingLimit.amount / 100).toString() : '');
  };

  const handleSave = async () => {
    if (!editingLimit) return;
    const cents = decimalStringToCents(amountStr);
    if (cents <= 0) return;

    const now = Date.now();
    const limitObj: BudgetLimit = {
      id: editingLimit.id || `limit_${now}_${Math.random().toString(36).substring(2, 6)}`,
      type: editingLimit.type,
      categoryId: editingLimit.categoryId,
      periodId: editingLimit.isPeriodOverride ? activePeriod.id : undefined,
      amount: cents,
      createdAt: now,
      updatedAt: now,
    };

    await onSaveLimit(limitObj);
    setEditingLimit(null);
  };

  const handleDelete = async () => {
    if (!editingLimit?.id) return;
    await onDeleteLimit(editingLimit.id);
    setEditingLimit(null);
  };

  const getTargetCategory = (catId?: string) => {
    return categories.find((c) => c.id === catId);
  };

  const currentCategory = getTargetCategory(editingLimit?.categoryId);

  return (
    <div className="w-full space-y-6 pb-28 animate-in fade-in duration-150">
      {/* Back button & Title */}
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Settings</span>
        </button>
        <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          Budget limits
        </h2>
      </div>

      {/* Section 1: EVERY CYCLE (Overall) */}
      <div className="space-y-2">
        <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)] px-1 block">
          EVERY CYCLE
        </span>

        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 space-y-2">
          <button
            type="button"
            onClick={() => openEditSheet('overall', undefined, overallLimit)}
            className="w-full text-left cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-[var(--text-primary)]">Overall</span>
              <div className="flex items-center gap-1">
                <span className="text-[var(--text-primary)] font-bold">
                  {overallLimit ? formatCents(overallLimit.amount, currency) : 'Set limit'}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              </div>
            </div>

            {overallLimit && (
              <div className="mt-2 space-y-1.5">
                {/* Progress bar */}
                <div className="w-full h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                  <div
                    style={{ width: `${overallPct}%` }}
                    className={`h-full rounded-full ${
                      isOverallOver ? 'bg-[var(--danger)]' : 'bg-[var(--accent)]'
                    }`}
                  />
                </div>

                {/* Short left/over line */}
                <p className={`text-[11px] font-medium ${isOverallOver ? 'text-[var(--danger)] font-bold' : 'text-[var(--text-secondary)]'}`}>
                  {isOverallOver
                    ? `${formatCents(Math.abs(overallRemaining), currency)} over`
                    : `${formatCents(overallRemaining, currency)} left`}
                </p>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Section 2: BY CATEGORY */}
      <div className="space-y-2">
        <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)] px-1 block">
          BY CATEGORY
        </span>

        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden">
          {categoryLimits.map((limit) => {
            const cat = getTargetCategory(limit.categoryId);
            if (!cat) return null;

            const catSpent = entries
              .filter((e) => e.date >= activePeriod.startDate && e.date <= activePeriod.endDate && e.categoryId === cat.id && e.type === 'expense')
              .reduce((sum, e) => sum + (e.homeAmount ?? e.amount ?? 0), 0);

            const remaining = limit.amount - catSpent;
            const isOver = remaining < 0;
            const pct = limit.amount > 0 ? Math.min(100, Math.round((catSpent / limit.amount) * 100)) : 0;

            return (
              <button
                key={limit.id}
                type="button"
                onClick={() => openEditSheet('category', cat.id, limit)}
                className="w-full p-4 text-left hover:bg-[var(--bg-elevated)]/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{cat.emoji}</span>
                    <span className="text-[var(--text-primary)]">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[var(--text-primary)] font-bold">
                      {formatCents(limit.amount, currency)}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  </div>
                </div>

                <div className="mt-2 space-y-1.5">
                  <div className="w-full h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full ${
                        isOver ? 'bg-[var(--danger)]' : 'bg-[var(--accent)]'
                      }`}
                    />
                  </div>

                  <p className={`text-[11px] font-medium ${isOver ? 'text-[var(--danger)] font-bold' : 'text-[var(--text-secondary)]'}`}>
                    {isOver
                      ? `${formatCents(Math.abs(remaining), currency)} over`
                      : `${formatCents(remaining, currency)} left`}
                  </p>
                </div>
              </button>
            );
          })}

          {/* "+ Add a category limit" */}
          <button
            type="button"
            onClick={() => {
              const unconfiguredCat = availableCategories[0];
              openEditSheet('category', unconfiguredCat?.id || expenseCategories[0]?.id);
            }}
            className="w-full p-4 text-left text-xs font-semibold text-[var(--accent)] hover:bg-[var(--bg-elevated)]/40 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add a category limit</span>
          </button>
        </div>
      </div>

      {/* Editing Sheet (AdaptiveModal: Centred dialog on >=640px, Bottom sheet on <640px) */}
      <AdaptiveModal
        id="budget_limits_page_sheet"
        isOpen={Boolean(editingLimit)}
        onClose={() => setEditingLimit(null)}
      >
        {/* Scrollable sheet body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
          {/* Header title */}
          <div>
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
              {editingLimit?.id ? (
                editingLimit.type === 'overall' ? 'Editing · Overall' : `Editing · ${currentCategory?.name || 'Category'}`
              ) : (
                editingLimit?.type === 'overall' ? 'New limit · Overall' : 'New limit · By category'
              )}
            </span>

            {/* Existing category limit shows category as title (emoji + name), not chips */}
            {editingLimit?.id && editingLimit.type === 'category' && currentCategory && (
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
          {editingLimit?.type === 'category' && !editingLimit.id && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">Category</label>
              {availableCategories.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {availableCategories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setEditingLimit({ ...editingLimit, categoryId: c.id })}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-full border cursor-pointer transition-all inline-flex items-center gap-1.5 ${
                        editingLimit.categoryId === c.id
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
          {editingLimit && (
            <div className="flex items-center bg-[var(--bg-elevated)] p-1 rounded-full w-fit">
              <button
                type="button"
                onClick={() => setEditingLimit({ ...editingLimit, isPeriodOverride: false })}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                  !editingLimit.isPeriodOverride
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Every cycle
              </button>
              <button
                type="button"
                onClick={() => setEditingLimit({ ...editingLimit, isPeriodOverride: true })}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                  editingLimit.isPeriodOverride
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                This cycle only
              </button>
            </div>
          )}
        </div>

        {/* Bottom Actions: Remove limit text button above Save (only when limit exists) */}
        <AdaptiveModalActions>
          {editingLimit?.id && (
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
    </div>
  );
};
