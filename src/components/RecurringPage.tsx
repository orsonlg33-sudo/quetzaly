/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeft, ChevronRight, Plus } from 'lucide-react';
import { RecurringRule, Category, UserSettings } from '../types/finance';
import { formatCents } from '../lib/currency';
import { formatFrequencySchedule, getNextOccurrenceDate, formatShortDate, getTodayDateString } from '../lib/recurringMath';
import { RecurringModal } from './RecurringModal';

interface RecurringPageProps {
  onBack: () => void;
  rules: RecurringRule[];
  categories: Category[];
  settings: UserSettings;
  onSaveRule: (rule: Partial<RecurringRule>) => Promise<void>;
  onDeleteRule: (ruleId: string) => Promise<void>;
}

export const RecurringPage: React.FC<RecurringPageProps> = ({
  onBack,
  rules,
  categories,
  settings,
  onSaveRule,
  onDeleteRule,
}) => {
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const getCategory = (catId: string, type: 'expense' | 'income'): Category => {
    return (
      categories.find((c) => c.id === catId) || {
        id: catId,
        name: 'General',
        emoji: type === 'income' ? '💰' : '📦',
        color: '#706764',
        type,
      }
    );
  };

  const handleOpenAdd = () => {
    setEditingRule(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rule: RecurringRule) => {
    setEditingRule(rule);
    setIsModalOpen(true);
  };

  const today = getTodayDateString();
  const activeCount = rules.filter((r) => r.active).length;

  return (
    <div className="w-full max-w-xl mx-auto space-y-4 pb-20 animate-in fade-in duration-150">
      {/* Top Header with Back Button (NO + Add button in header) */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          aria-label="Back to Settings"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            Recurring
          </h2>
        </div>
      </div>

      {/* Small Section Label: ACTIVE · N */}
      <div className="px-1">
        <span className="text-[11px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase">
          ACTIVE · {activeCount}
        </span>
      </div>

      {/* List Container */}
      <div className="bg-[var(--bg-surface)] rounded-[28px] border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden">
        {rules.length === 0 ? (
          /* Empty state: ONE short line of text and a single amber "Add recurring entry" button (NO icon in a circle) */
          <div className="p-8 text-center space-y-3">
            <p className="text-xs text-[var(--text-secondary)]">
              No recurring entries yet
            </p>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-5 py-2.5 text-xs font-semibold rounded-2xl bg-[var(--accent)] text-black shadow-sm hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>Add recurring entry</span>
            </button>
          </div>
        ) : (
          <>
            {/* Rules list with plain rows and hairline dividers */}
            {rules.map((rule) => {
              const category = getCategory(rule.categoryId, rule.type);
              const isIncome = rule.type === 'income';
              const scheduleDesc = formatFrequencySchedule(rule);
              const nextDue = getNextOccurrenceDate(rule, today);
              const nextDueStr = nextDue ? `Next: ${formatShortDate(nextDue)}` : 'Ended';

              return (
                <div
                  key={rule.id}
                  onClick={() => handleOpenEdit(rule)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--bg-elevated)]/40 transition-colors cursor-pointer group"
                >
                  {/* Left: Emoji and details */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-2xl shrink-0">{category.emoji}</span>

                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                          {rule.note || category.name}
                        </span>
                        {!rule.active && (
                          <span className="text-[10px] font-semibold text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded-full">
                            Paused
                          </span>
                        )}
                        {rule.autoAdd && (
                          <span className="text-[10px] font-semibold text-[var(--accent)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded-full">
                            Auto
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] mt-0.5">
                        <span>{scheduleDesc}</span>
                        <span>·</span>
                        <span className={!rule.active ? 'opacity-60' : ''}>{nextDueStr}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount and chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs sm:text-sm font-semibold tabular-nums ${
                        isIncome ? 'text-[var(--income)]' : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {isIncome ? '+' : ''}
                      {formatCents(rule.amount, rule.currency)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]/50 group-hover:text-[var(--text-secondary)] transition-colors" />
                  </div>
                </div>
              );
            })}

            {/* ONE Add action only: the amber "+ Add recurring entry" row at the END of the list */}
            <button
              type="button"
              onClick={handleOpenAdd}
              className="w-full flex items-center gap-2 p-4 text-left hover:bg-[var(--bg-elevated)]/40 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[var(--accent)] shrink-0" />
              <span className="text-xs font-semibold text-[var(--accent)]">
                Add recurring entry
              </span>
            </button>
          </>
        )}
      </div>

      {/* Modal for adding/editing recurring rule */}
      <RecurringModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingRule(null);
        }}
        editingRule={editingRule}
        categories={categories}
        settings={settings}
        onSave={onSaveRule}
        onDelete={onDeleteRule}
      />
    </div>
  );
};
