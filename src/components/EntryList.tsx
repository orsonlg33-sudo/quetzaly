/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Search, Camera, ChevronRight, X, Copy, Edit2, Trash2 } from 'lucide-react';
import { Category, FinanceEntry, UserSettings, RecurringRule } from '../types/finance';
import { formatCents, formatTransactionDate } from '../lib/currency';
import { AdaptiveModal } from './AdaptiveModal';

interface EntryListProps {
  entries: FinanceEntry[];
  categories: Category[];
  settings: UserSettings;
  recurringRules?: RecurringRule[];
  onEdit: (entry: FinanceEntry) => void;
  onDuplicate: (entry: FinanceEntry) => void;
  onDelete: (entry: FinanceEntry) => void;
  onViewReceipt: (entry: FinanceEntry) => void;
  onUpdateRate?: (entry: FinanceEntry, newRate: number) => void;
  onOpenRecurring?: (entry: FinanceEntry) => void;
  showSearch?: boolean;
}

export const EntryList: React.FC<EntryListProps> = ({
  entries,
  categories,
  settings,
  recurringRules,
  onEdit,
  onDuplicate,
  onDelete,
  onViewReceipt,
  onUpdateRate,
  onOpenRecurring,
  showSearch = false,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeDetailEntry, setActiveDetailEntry] = useState<FinanceEntry | null>(null);

  // Filter entries by search query if enabled
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter((e) => {
      const cat = categories.find((c) => c.id === e.categoryId);
      const catName = cat ? cat.name.toLowerCase() : '';
      const note = e.note ? e.note.toLowerCase() : '';
      const amountStr = (e.amount / 100).toString();
      return catName.includes(q) || note.includes(q) || amountStr.includes(q) || e.currency.toLowerCase().includes(q);
    });
  }, [entries, searchQuery, categories]);

  if (entries.length === 0) {
    return (
      <div className="w-full bg-[var(--bg-surface)] rounded-[28px] p-8 border border-[var(--border-subtle)] flex flex-col items-center justify-center text-center">
        <span className="text-3xl mb-2">🌿</span>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          No transactions found
        </h3>
        <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm">
          No entries have been logged yet. Use the central + button below to log one.
        </p>
      </div>
    );
  }

  // Group entries by date
  const groups = new Map<string, FinanceEntry[]>();
  for (const entry of filteredEntries) {
    const list = groups.get(entry.date) || [];
    list.push(entry);
    groups.set(entry.date, list);
  }

  const sortedDates = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));

  const getCategory = (catId: string, type: string): Category => {
    return (
      categories.find((c) => c.id === catId) || {
        id: catId,
        name: 'General',
        emoji: type === 'income' ? '💰' : '📦',
        color: '#706764',
        type: type as any,
      }
    );
  };

  return (
    <div className="w-full space-y-4">
      {/* Search Bar */}
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes, categories, amounts"
            className="w-full pl-11 pr-4 py-3 text-xs rounded-full bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
      )}

      <div className="space-y-6">
        {sortedDates.map((dateKey) => {
          const dateEntries = groups.get(dateKey) || [];
          const dayTotal = dateEntries.reduce((sum, e) => {
            if (e.type === 'expense') {
              return sum + (e.homeAmount ?? e.amount ?? 0);
            }
            return sum - (e.homeAmount ?? e.amount ?? 0);
          }, 0);

          return (
            <div key={dateKey} className="space-y-1">
              {/* Date Header with Net Total on the Right */}
              <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-secondary)] px-2 pb-1 border-b border-[var(--border-subtle)]">
                <span>{formatTransactionDate(dateKey)}</span>
                <span className="tabular-nums text-[var(--text-primary)]">
                  {formatCents(Math.abs(dayTotal), settings.homeCurrency)}
                </span>
              </div>

              {/* Ledger Rows sitting on the canvas with hairline dividers */}
              <div className="divide-y divide-[var(--border-subtle)] px-1">
                {dateEntries.map((entry) => {
                  const category = getCategory(entry.categoryId, entry.type);
                  const isIncome = entry.type === 'income';
                  const isForeign = entry.currency.toUpperCase() !== settings.homeCurrency.toUpperCase();

                  return (
                    <div
                      key={entry.id}
                      onClick={() => setActiveDetailEntry(entry)}
                      className="group flex items-center justify-between py-3.5 cursor-pointer hover:bg-[var(--bg-elevated)]/40 transition-colors gap-2"
                    >
                      {/* Left: Emoji alone without circle & Category/Note */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-xl shrink-0">{category.emoji}</span>

                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                              {category.name}
                            </span>
                            {entry.recurringId && (
                              <span className="text-xs text-[var(--accent)] font-bold shrink-0" title="Recurring entry">
                                ↻
                              </span>
                            )}
                            {entry.isSample && (
                              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                                Sample
                              </span>
                            )}
                          </div>

                          {entry.note ? (
                            <p className="text-[11px] text-[var(--text-secondary)] truncate">
                              {entry.note}
                            </p>
                          ) : isForeign ? (
                            <p className="text-[11px] text-[var(--text-secondary)]">
                              {formatCents(entry.amount, entry.currency)}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {/* Right: Home Currency Amount (expenses normal text, income green) */}
                      <div className="flex items-center gap-2 shrink-0">
                        {entry.photoUrl && <Camera className="w-3.5 h-3.5 text-[var(--text-secondary)]" />}

                        <span
                          className={`text-xs sm:text-sm font-semibold tabular-nums ${
                            isIncome ? 'text-[var(--income)]' : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {isIncome ? '+' : ''}
                          {formatCents(entry.homeAmount ?? entry.amount, settings.homeCurrency)}
                        </span>

                        <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]/50 group-hover:text-[var(--text-secondary)]" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Sheet / Dialog on Tap (Pass 4 target) */}
      <AdaptiveModal
        id="entry_list_detail_sheet"
        isOpen={Boolean(activeDetailEntry)}
        onClose={() => setActiveDetailEntry(null)}
      >
        {activeDetailEntry && (() => {
          const category = getCategory(activeDetailEntry.categoryId, activeDetailEntry.type);
          const isForeign = activeDetailEntry.currency.toUpperCase() !== settings.homeCurrency.toUpperCase();
          const formattedHomeAmt = formatCents(activeDetailEntry.homeAmount ?? activeDetailEntry.amount, settings.homeCurrency);
          const formattedForeignAmt = formatCents(activeDetailEntry.amount, activeDetailEntry.currency);
          const rateStatusText = activeDetailEntry.rateStatus === 'fetched'
            ? `Rate from ${formatTransactionDate(activeDetailEntry.date).split(', ')[1] || activeDetailEntry.date}`
            : activeDetailEntry.rateStatus === 'estimated'
            ? 'Estimated rate'
            : 'Manual rate';

          return (
            <div className="p-6 space-y-6 overflow-y-auto flex-1 flex flex-col justify-between">
              <div className="space-y-5">
                {/* Header: Headline amount & conversion line */}
                <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
                  <div>
                    <h3 className="text-3xl font-extrabold tabular-nums text-[var(--text-primary)] tracking-tight">
                      {formattedHomeAmt}
                    </h3>
                    {isForeign && (
                      <p className="text-xs text-[var(--text-secondary)] mt-1">
                        {formattedForeignAmt} · 1 {activeDetailEntry.currency} = {activeDetailEntry.rate.toFixed(2)} {settings.homeCurrency}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveDetailEntry(null)}
                    className="p-1.5 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer self-start"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Rate status line for foreign entries: plain text with no background, no border */}
                {isForeign && (
                  <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] py-1">
                    <span>{rateStatusText}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const entry = activeDetailEntry;
                        setActiveDetailEntry(null);
                        onEdit(entry);
                      }}
                      className="font-semibold text-[var(--accent)] hover:underline cursor-pointer"
                    >
                      Edit rate
                    </button>
                  </div>
                )}

                {/* Plain label/value rows with hairline dividers */}
                <div className="divide-y divide-[var(--border-subtle)] text-xs">
                  <div className="py-3 flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">Category</span>
                    <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                      <span>{category.emoji}</span>
                      <span>{category.name}</span>
                    </div>
                  </div>

                  <div className="py-3 flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">Date</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {formatTransactionDate(activeDetailEntry.date)}
                    </span>
                  </div>

                  <div className="py-3 flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">Note</span>
                    <span className={activeDetailEntry.note ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)] italic'}>
                      {activeDetailEntry.note || 'Add a note'}
                    </span>
                  </div>

                  <div className="py-3 flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">Receipt</span>
                    {activeDetailEntry.photoUrl ? (
                      <button
                        type="button"
                        onClick={() => onViewReceipt(activeDetailEntry)}
                        className="font-semibold text-[var(--accent)] hover:underline cursor-pointer"
                      >
                        Receipt attached
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const entry = activeDetailEntry;
                          setActiveDetailEntry(null);
                          onEdit(entry);
                        }}
                        className="font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        Add
                      </button>
                    )}
                  </div>

                  {/* Repeat row */}
                  <div className="py-3 flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">Repeat</span>
                    <button
                      type="button"
                      onClick={() => {
                        const entry = activeDetailEntry;
                        setActiveDetailEntry(null);
                        if (onOpenRecurring) {
                          onOpenRecurring(entry);
                        }
                      }}
                      className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                    >
                      {activeDetailEntry.recurringId
                        ? (() => {
                            const rule = recurringRules?.find((r) => r.id === activeDetailEntry.recurringId);
                            if (!rule) return 'Repeats';
                            if (rule.frequency === 'weekly') return 'Repeats weekly';
                            if (rule.frequency === 'biweekly') return 'Repeats every 2 weeks';
                            if (rule.frequency === 'monthly') return 'Repeats monthly';
                            if (rule.frequency === 'yearly') return 'Repeats yearly';
                            return 'Repeats';
                          })()
                        : 'Does not repeat'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer: Delete red text left, Duplicate outline pill, Edit amber filled pill */}
              <div className="flex items-center justify-between gap-3 pt-4 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => {
                    const entry = activeDetailEntry;
                    setActiveDetailEntry(null);
                    onDelete(entry);
                  }}
                  className="text-xs font-semibold text-[var(--danger)] hover:underline cursor-pointer py-2"
                >
                  Delete
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const entry = activeDetailEntry;
                      setActiveDetailEntry(null);
                      onDuplicate(entry);
                    }}
                    className="px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const entry = activeDetailEntry;
                      setActiveDetailEntry(null);
                      onEdit(entry);
                    }}
                    className="px-5 py-2 text-xs font-semibold rounded-xl bg-[var(--accent)] text-black hover:opacity-90 shadow-sm transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </AdaptiveModal>
    </div>
  );
};
