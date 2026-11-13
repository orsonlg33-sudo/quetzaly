/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import {
  Category,
  FinanceEntry,
  UserSettings,
  BudgetPeriod,
  UndoAction,
  BudgetLimit,
  RecurringRule,
  RecurringOccurrence,
  DueOccurrence,
} from './types/finance';
import {
  getAllEntries,
  addEntry,
  updateEntry,
  deleteEntry,
  clearSampleEntries,
  bulkAddEntries,
  initDefaultCategoriesIfNeeded,
  getStoredSettings,
  saveStoredSettings,
  requestPersistentStorage,
  migrateExistingEntries,
  refreshPendingRates,
  recomputeAllEntriesForNewHomeCurrency,
  getAllLimits,
  saveLimit,
  deleteLimit,
  saveCategory,
  deleteOrArchiveCategory,
  unarchiveCategory,
  getAllRecurringRules,
  saveRecurringRule,
  deleteRecurringRule,
  getRecurringOccurrencesMap,
  saveRecurringOccurrence,
  bulkSaveRecurringOccurrences,
} from './lib/db';
import {
  getPeriodForDate,
  getOffsetPeriod,
  calculatePeriodSummary,
  formatDateKey,
} from './lib/periodMath';
import {
  getPendingDueOccurrences,
  getTodayDateString,
  parseDate,
} from './lib/recurringMath';
import { generateSampleEntries, DEFAULT_SETTINGS } from './lib/defaults';
import { getExchangeRate, calculateHomeAmountCents } from './lib/exchangeRate';
import { applyWelcomeSkip, applyWelcomeGetStarted } from './lib/welcomeLogic';
import { resolveTheme, getSystemPrefersDark, applyThemeToDom } from './lib/theme';

// Components
import { PeriodHeader } from './components/PeriodHeader';
import { PeriodSummary } from './components/PeriodSummary';
import { CategoryBreakdown } from './components/CategoryBreakdown';
import { EntryList } from './components/EntryList';
import { EntryModal } from './components/EntryModal';
import { ReceiptModal } from './components/ReceiptModal';
import { UndoToast } from './components/UndoToast';
import { PWAUpdateToast } from './components/PWAUpdateToast';
import { usePWA } from './hooks/usePWA';
import { SettingsModal } from './components/SettingsModal';
import { GlobalViewModal } from './components/GlobalViewModal';
import { CategoryManagerModal } from './components/CategoryManagerModal';
import { BudgetLimitModal } from './components/BudgetLimitModal';
import { InsightHeader } from './components/InsightHeader';
import { VelocityHeroCard } from './components/VelocityHeroCard';
import { DailyBarChart } from './components/DailyBarChart';
import { SixCycleTrendWidget } from './components/SixCycleTrendWidget';
import { EarnedVsSpentWidget } from './components/EarnedVsSpentWidget';
import { BottomNav } from './components/BottomNav';
import { WarmEmberBalanceCard } from './components/WarmEmberBalanceCard';
import { SettingsView } from './components/SettingsView';
import { BudgetLimitsPage } from './components/BudgetLimitsPage';
import { RecurringPage } from './components/RecurringPage';
import { RecurringModal } from './components/RecurringModal';
import { HomeDueSection } from './components/HomeDueSection';
import { WelcomeModal } from './components/WelcomeModal';

export default function App() {
  const { updateAvailable, reloadApp } = usePWA();
  const [dismissedUpdateToast, setDismissedUpdateToast] = useState<boolean>(false);

  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState<boolean>(false);
  const [storageUnavailable, setStorageUnavailable] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [isWelcomeOpen, setIsWelcomeOpen] = useState<boolean>(false);
  const hasDismissedWelcomeSessionRef = React.useRef<boolean>(false);

  // Active period being viewed on the dashboard
  const [activePeriod, setActivePeriod] = useState<BudgetPeriod>(() =>
    getPeriodForDate(new Date(), DEFAULT_SETTINGS.monthStartDay)
  );

  // Modals state
  const [isEntryModalOpen, setIsEntryModalOpen] = useState<boolean>(false);
  const [editingEntry, setEditingEntry] = useState<FinanceEntry | null>(null);

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [activeReceiptEntry, setActiveReceiptEntry] = useState<FinanceEntry | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isGlobalViewOpen, setIsGlobalViewOpen] = useState<boolean>(false);

  const [limits, setLimits] = useState<BudgetLimit[]>([]);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState<boolean>(false);
  const [isBudgetLimitModalOpen, setIsBudgetLimitModalOpen] = useState<boolean>(false);
  const [budgetLimitModalConfig, setBudgetLimitModalConfig] = useState<{
    type: 'overall' | 'category';
    categoryId?: string;
  }>({ type: 'overall' });

  // Undo notification state
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);

  // Active navigation tab state
  const [activeTab, setActiveTab] = useState<'home' | 'transactions' | 'insights' | 'settings'>('home');
  const [isBudgetLimitsPageOpen, setIsBudgetLimitsPageOpen] = useState<boolean>(false);
  const [isRecurringPageOpen, setIsRecurringPageOpen] = useState<boolean>(false);

  // Recurring entries state
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [dueOccurrences, setDueOccurrences] = useState<DueOccurrence[]>([]);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState<boolean>(false);
  const [editingRecurringRule, setEditingRecurringRule] = useState<RecurringRule | null>(null);
  const [recurringModalInitialData, setRecurringModalInitialData] = useState<Partial<RecurringRule> | undefined>(undefined);

  // Function to refresh pending and estimated entries when online
  const checkAndRefreshPending = useCallback(async (homeCurr: string) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    try {
      const res = await refreshPendingRates(homeCurr, getExchangeRate);
      if (res.convertedCount > 0) {
        setEntries(res.updated);
      }
    } catch {
      // Ignore background refresh errors
    }
  }, []);

  // Compute and process recurring entries
  const checkRecurringEntries = useCallback(
    async (currentRules: RecurringRule[], currentHomeCurrency: string) => {
      if (currentRules.length === 0) {
        setDueOccurrences([]);
        return;
      }
      const today = getTodayDateString();
      const occMap = await getRecurringOccurrencesMap();

      const autoToPost: Array<{ rule: RecurringRule; date: string }> = [];
      const manualDue: DueOccurrence[] = [];

      for (const rule of currentRules) {
        if (!rule.active) continue;
        const pendingDates = getPendingDueOccurrences(rule, today, occMap);
        for (const d of pendingDates) {
          if (rule.autoAdd) {
            autoToPost.push({ rule, date: d });
          } else {
            manualDue.push({ rule, date: d });
          }
        }
      }

      setDueOccurrences(manualDue);

      if (autoToPost.length > 0) {
        const createdEntries: FinanceEntry[] = [];
        const occurrencesToSave: RecurringOccurrence[] = [];
        const now = Date.now();

        for (const item of autoToPost) {
          const entryId = `entry_${now}_${Math.random().toString(36).substring(2, 7)}`;
          let rate = 1.0;
          let homeAmount = item.rule.amount;
          let rateStatus: any = 'fetched';

          if (item.rule.currency.toUpperCase() !== currentHomeCurrency.toUpperCase()) {
            try {
              const res = await getExchangeRate(item.rule.currency, currentHomeCurrency, item.date);
              if (res.rate > 0) {
                rate = res.rate;
                homeAmount = calculateHomeAmountCents(item.rule.amount, res.rate);
                rateStatus = res.rateStatus;
              } else {
                rateStatus = 'pending';
              }
            } catch {
              rateStatus = 'pending';
            }
          }

          const newEntry: FinanceEntry = {
            id: entryId,
            recurringId: item.rule.id,
            occurrenceDate: item.date,
            type: item.rule.type,
            amount: item.rule.amount,
            currency: item.rule.currency,
            homeAmount,
            rate,
            rateStatus,
            rateEditedManually: false,
            date: item.date,
            categoryId: item.rule.categoryId,
            note: item.rule.note,
            isSample: false,
            createdAt: now,
            updatedAt: now,
          };

          createdEntries.push(newEntry);
          occurrencesToSave.push({
            id: `${item.rule.id}_${item.date}`,
            ruleId: item.rule.id,
            date: item.date,
            status: 'posted',
            entryId: newEntry.id,
            updatedAt: now,
          });
        }

        await bulkAddEntries(createdEntries);
        await bulkSaveRecurringOccurrences(occurrencesToSave);

        setEntries((prev) => [...createdEntries, ...prev]);

        setUndoAction({
          id: `undo_rec_${now}`,
          title:
            createdEntries.length === 1
              ? 'Added 1 recurring entry'
              : `Added ${createdEntries.length} recurring entries`,
          type: 'add',
          entry: createdEntries[0],
          entries: createdEntries,
          timestamp: now,
        });
      }
    },
    []
  );

  // Initialize DB, migrate existing entries, load categories & settings
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      requestPersistentStorage().catch(() => {});

      const [loadedSettings, loadedCategories, loadedLimits, loadedRules] = await Promise.all([
        getStoredSettings(),
        initDefaultCategoriesIfNeeded(),
        getAllLimits(),
        getAllRecurringRules(),
      ]);

      setSettings(loadedSettings);
      setIsSettingsLoaded(true);
      setStorageUnavailable(false);
      setCategories(loadedCategories);
      setLimits(loadedLimits);
      setRecurringRules(loadedRules);

      // Run data migration ensuring rate fields and homeCurrency 1:1 integrity
      const migratedEntries = await migrateExistingEntries(loadedSettings.homeCurrency);
      setEntries(migratedEntries);

      // Check and generate recurring entries
      await checkRecurringEntries(loadedRules, loadedSettings.homeCurrency);

      // Update active period with stored monthStartDay
      const currentCycle = getPeriodForDate(new Date(), loadedSettings.monthStartDay);
      setActivePeriod(currentCycle);

      // Theme initialization (defaults to dark if no saved preference)
      const initialTheme = resolveTheme(loadedSettings.themeMode, getSystemPrefersDark());
      setTheme(initialTheme);
      applyThemeToDom(initialTheme);

      // Check and refresh pending rates in background
      checkAndRefreshPending(loadedSettings.homeCurrency);

      // Check if welcome screen should be shown (only on truly empty first launch)
      const hasAnyData = migratedEntries.length > 0 || loadedLimits.length > 0 || loadedRules.length > 0;
      if (!hasAnyData && !loadedSettings.hasSeenWelcome) {
        setIsWelcomeOpen(true);
      }
    } catch (err) {
      console.error('Initialization failed:', err);
      applyThemeToDom('dark');
      setStorageUnavailable(true);
      if (!hasDismissedWelcomeSessionRef.current) {
        setIsWelcomeOpen(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [checkAndRefreshPending, checkRecurringEntries]);

  const handleCloseWelcome = async () => {
    setIsWelcomeOpen(false);
    hasDismissedWelcomeSessionRef.current = true;
    try {
      const updated = await applyWelcomeSkip({
        isSettingsLoaded,
        saveSettings: saveStoredSettings,
      });
      if (updated) {
        setSettings(updated);
      } else {
        setSettings((prev) => ({ ...prev, hasSeenWelcome: true }));
      }
    } catch {
      // Fail quietly, keep in-memory hasSeenWelcome state
      setSettings((prev) => ({ ...prev, hasSeenWelcome: true }));
    }
  };

  const handleGetStartedWelcome = async (updates: Partial<UserSettings>) => {
    setIsWelcomeOpen(false);
    hasDismissedWelcomeSessionRef.current = true;
    try {
      const { saved, currencyChanged, dayChanged } = await applyWelcomeGetStarted({
        isSettingsLoaded,
        currentSettings: settings,
        updates,
        saveSettings: saveStoredSettings,
      });

      if (saved) {
        setSettings(saved);
        if (dayChanged && saved.monthStartDay !== undefined) {
          setActivePeriod(getPeriodForDate(new Date(), saved.monthStartDay));
        }
        if (currencyChanged && saved.homeCurrency && entries.length > 0) {
          const recomputed = await recomputeAllEntriesForNewHomeCurrency(
            saved.homeCurrency,
            getExchangeRate
          );
          setEntries(recomputed);
        }
      } else {
        setSettings((prev) => ({ ...prev, hasSeenWelcome: true }));
      }
    } catch {
      // Fail quietly, keep in-memory hasSeenWelcome state
      setSettings((prev) => ({ ...prev, hasSeenWelcome: true }));
    }
    setEditingEntry(null);
    setIsEntryModalOpen(true);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Date change and online listeners
  useEffect(() => {
    let lastDate = getTodayDateString();
    const interval = setInterval(() => {
      const today = getTodayDateString();
      if (today !== lastDate) {
        lastDate = today;
        checkRecurringEntries(recurringRules, settings.homeCurrency);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [recurringRules, settings.homeCurrency, checkRecurringEntries]);

  // Listen to 'online' event to auto-convert pending entries
  useEffect(() => {
    const handleOnline = () => {
      checkAndRefreshPending(settings.homeCurrency);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [settings.homeCurrency, checkAndRefreshPending]);

  // Follow device theme changes only when user explicitly saved 'system'
  useEffect(() => {
    if (
      settings.themeMode !== 'system' ||
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const next = resolveTheme('system', e.matches);
      setTheme(next);
      applyThemeToDom(next);
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, [settings.themeMode]);

  // Sync theme changes with DOM
  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    applyThemeToDom(nextTheme);
    setSettings((prev) => ({ ...prev, themeMode: nextTheme }));
    saveStoredSettings({ themeMode: nextTheme });
  };

  // Filter by date state (from tapping daily bar chart)
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);

  // True current calendar period (based on today's date)
  const currentCalendarPeriod = useMemo(() => {
    return getPeriodForDate(new Date(), settings.monthStartDay || 22);
  }, [settings.monthStartDay]);

  // Previous budget period for cycle-over-cycle comparisons
  const previousPeriod = useMemo(() => {
    return getOffsetPeriod(activePeriod, -1, settings.monthStartDay || 22);
  }, [activePeriod, settings.monthStartDay]);

  // Count sample entries
  const sampleCount = useMemo(() => {
    return entries.filter((e) => e.isSample).length;
  }, [entries]);

  // Entries filtered for active budget cycle
  const periodEntries = useMemo(() => {
    return entries.filter(
      (entry) => entry.date >= activePeriod.startDate && entry.date <= activePeriod.endDate
    );
  }, [entries, activePeriod]);

  // Entries for previous budget cycle
  const previousPeriodEntries = useMemo(() => {
    return entries.filter(
      (entry) => entry.date >= previousPeriod.startDate && entry.date <= previousPeriod.endDate
    );
  }, [entries, previousPeriod]);

  // Displayed entries (filtered to single date if date filter active)
  const displayedPeriodEntries = useMemo(() => {
    if (!selectedDateFilter) return periodEntries;
    return periodEntries.filter((entry) => entry.date === selectedDateFilter);
  }, [periodEntries, selectedDateFilter]);

  // Summary statistics for active period (all converted to home currency)
  const periodSummary = useMemo(() => {
    return calculatePeriodSummary(entries, activePeriod, settings.rolloverEnabled);
  }, [entries, activePeriod, settings.rolloverEnabled]);

  // Period navigation
  const handlePreviousPeriod = () => {
    setActivePeriod((prev) => getOffsetPeriod(prev, -1, settings.monthStartDay || 22));
  };

  const handleNextPeriod = () => {
    setActivePeriod((prev) => getOffsetPeriod(prev, 1, settings.monthStartDay || 22));
  };

  const handleJumpToCurrent = () => {
    setActivePeriod(currentCalendarPeriod);
  };

  // Add / Edit Entry Handler
  const handleSaveEntry = async (entryData: Partial<FinanceEntry>) => {
    const now = Date.now();
    const isEdit = Boolean(entryData.id);

    if (isEdit && entryData.id) {
      const existing = entries.find((e) => e.id === entryData.id);
      if (!existing) return;

      const updated: FinanceEntry = {
        ...existing,
        ...entryData,
        updatedAt: now,
      } as FinanceEntry;

      await updateEntry(updated);
      setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));

      // Trigger undo
      setUndoAction({
        id: `undo_${now}`,
        title: `Updated ${entryData.type === 'income' ? 'income' : 'expense'}`,
        type: 'edit',
        entry: updated,
        previousEntry: existing,
        timestamp: now,
      });
    } else {
      // New Entry (Home currency is never altered by logging an entry)
      const entryCurrency = entryData.currency || settings.lastUsedCurrency || settings.homeCurrency;

      const newEntry: FinanceEntry = {
        id: `entry_${now}_${Math.random().toString(36).substring(2, 7)}`,
        type: entryData.type || 'expense',
        amount: entryData.amount || 0,
        currency: entryCurrency,
        homeAmount: entryData.homeAmount ?? entryData.amount ?? 0,
        rate: entryData.rate ?? 1.0,
        rateStatus: entryData.rateStatus || (entryCurrency === settings.homeCurrency ? 'fetched' : 'pending'),
        rateEditedManually: Boolean(entryData.rateEditedManually),
        date: entryData.date || formatDateKey(new Date()),
        categoryId: entryData.categoryId || categories[0]?.id || 'cat_other_exp',
        note: entryData.note,
        photoUrl: entryData.photoUrl,
        isSample: false,
        createdAt: now,
        updatedAt: now,
      };

      await addEntry(newEntry);
      setEntries((prev) => [newEntry, ...prev]);

      // Remember last used currency and update 4 most recently used currencies
      const currentRecents = settings.recentCurrencies || [];
      const updatedRecents = [
        newEntry.currency,
        ...currentRecents.filter((c) => c.toUpperCase() !== newEntry.currency.toUpperCase()),
      ].slice(0, 4);

      saveStoredSettings({
        lastUsedCurrency: newEntry.currency,
        recentCurrencies: updatedRecents,
      }).then((updated) => setSettings(updated));

      // Trigger undo
      setUndoAction({
        id: `undo_${now}`,
        title: `Logged ${newEntry.type === 'income' ? 'income' : 'expense'}`,
        type: 'add',
        entry: newEntry,
        timestamp: now,
      });
    }

    setEditingEntry(null);
  };

  // Duplicate entry handler
  const handleDuplicateEntry = (entry: FinanceEntry) => {
    setEditingEntry({
      ...entry,
      id: '',
      date: formatDateKey(new Date()),
      note: entry.note ? `${entry.note} (Copy)` : 'Copy',
    });
    setIsEntryModalOpen(true);
  };

  // Delete entry handler
  const handleDeleteEntry = async (entry: FinanceEntry) => {
    await deleteEntry(entry.id);
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));

    const now = Date.now();
    setUndoAction({
      id: `undo_${now}`,
      title: `Deleted entry`,
      type: 'delete',
      entry,
      timestamp: now,
    });
  };

  // Manual rate update handler
  const handleUpdateEntryRate = async (entry: FinanceEntry, newRate: number) => {
    const homeAmount = calculateHomeAmountCents(entry.amount, newRate);
    const updated: FinanceEntry = {
      ...entry,
      rate: newRate,
      homeAmount,
      rateStatus: 'manual',
      rateEditedManually: true,
      updatedAt: Date.now(),
    };
    await updateEntry(updated);
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  };

  // Undo handler
  const handleUndo = async (action: UndoAction) => {
    if (action.type === 'add') {
      if (action.entries && action.entries.length > 0) {
        for (const e of action.entries) {
          await deleteEntry(e.id);
        }
        const ids = new Set(action.entries.map((e) => e.id));
        setEntries((prev) => prev.filter((e) => !ids.has(e.id)));
      } else {
        await deleteEntry(action.entry.id);
        setEntries((prev) => prev.filter((e) => e.id !== action.entry.id));
      }
    } else if (action.type === 'delete') {
      await addEntry(action.entry);
      setEntries((prev) => [action.entry, ...prev]);
    } else if (action.type === 'edit' && action.previousEntry) {
      await updateEntry(action.previousEntry);
      setEntries((prev) =>
        prev.map((e) => (e.id === action.previousEntry!.id ? action.previousEntry! : e))
      );
    }
    setUndoAction(null);
  };

  // Recurring rule save / delete handlers
  const handleSaveRecurringRule = async (ruleData: Partial<RecurringRule>) => {
    const now = Date.now();
    const rule: RecurringRule = {
      id: ruleData.id || `rec_${now}_${Math.random().toString(36).substring(2, 7)}`,
      type: ruleData.type || 'expense',
      amount: ruleData.amount || 0,
      currency: ruleData.currency || settings.homeCurrency,
      categoryId: ruleData.categoryId || categories[0]?.id || 'cat_other_exp',
      note: ruleData.note,
      frequency: ruleData.frequency || 'monthly',
      monthlyDay: ruleData.monthlyDay,
      startDate: ruleData.startDate || getTodayDateString(),
      endDate: ruleData.endDate,
      active: ruleData.active !== false,
      autoAdd: Boolean(ruleData.autoAdd),
      createdAt: ruleData.createdAt || now,
      updatedAt: now,
      lastGeneratedDate: ruleData.lastGeneratedDate,
    };

    await saveRecurringRule(rule);
    const updatedRules = await getAllRecurringRules();
    setRecurringRules(updatedRules);

    await checkRecurringEntries(updatedRules, settings.homeCurrency);
  };

  const handleDeleteRecurringRule = async (ruleId: string) => {
    await deleteRecurringRule(ruleId);
    setRecurringRules((prev) => prev.filter((r) => r.id !== ruleId));
    setDueOccurrences((prev) => prev.filter((d) => d.rule.id !== ruleId));
  };

  // Due occurrences actions (Add / Skip)
  const handleConfirmDueOccurrence = async (due: DueOccurrence) => {
    const now = Date.now();
    const entryId = `entry_${now}_${Math.random().toString(36).substring(2, 7)}`;
    let rate = 1.0;
    let homeAmount = due.rule.amount;
    let rateStatus: any = 'fetched';

    if (due.rule.currency.toUpperCase() !== settings.homeCurrency.toUpperCase()) {
      try {
        const res = await getExchangeRate(due.rule.currency, settings.homeCurrency, due.date);
        if (res.rate > 0) {
          rate = res.rate;
          homeAmount = calculateHomeAmountCents(due.rule.amount, res.rate);
          rateStatus = res.rateStatus;
        } else {
          rateStatus = 'pending';
        }
      } catch {
        rateStatus = 'pending';
      }
    }

    const newEntry: FinanceEntry = {
      id: entryId,
      recurringId: due.rule.id,
      occurrenceDate: due.date,
      type: due.rule.type,
      amount: due.rule.amount,
      currency: due.rule.currency,
      homeAmount,
      rate,
      rateStatus,
      rateEditedManually: false,
      date: due.date,
      categoryId: due.rule.categoryId,
      note: due.rule.note,
      isSample: false,
      createdAt: now,
      updatedAt: now,
    };

    const occ: RecurringOccurrence = {
      id: `${due.rule.id}_${due.date}`,
      ruleId: due.rule.id,
      date: due.date,
      status: 'posted',
      entryId: newEntry.id,
      updatedAt: now,
    };

    await addEntry(newEntry);
    await saveRecurringOccurrence(occ);

    setEntries((prev) => [newEntry, ...prev]);
    setDueOccurrences((prev) =>
      prev.filter((d) => !(d.rule.id === due.rule.id && d.date === due.date))
    );

    setUndoAction({
      id: `undo_${now}`,
      title: `Logged recurring ${newEntry.type === 'income' ? 'income' : 'expense'}`,
      type: 'add',
      entry: newEntry,
      timestamp: now,
    });
  };

  const handleSkipDueOccurrence = async (due: DueOccurrence) => {
    const now = Date.now();
    const occ: RecurringOccurrence = {
      id: `${due.rule.id}_${due.date}`,
      ruleId: due.rule.id,
      date: due.date,
      status: 'skipped',
      updatedAt: now,
    };
    await saveRecurringOccurrence(occ);
    setDueOccurrences((prev) =>
      prev.filter((d) => !(d.rule.id === due.rule.id && d.date === due.date))
    );
  };

  // Open Recurring modal prefilled from entry
  const handleOpenRecurringFromEntry = (entry: FinanceEntry) => {
    if (entry.recurringId) {
      const existing = recurringRules.find((r) => r.id === entry.recurringId);
      if (existing) {
        setEditingRecurringRule(existing);
        setRecurringModalInitialData(undefined);
        setIsRecurringModalOpen(true);
        return;
      }
    }

    setEditingRecurringRule(null);
    setRecurringModalInitialData({
      type: entry.type,
      amount: entry.amount,
      currency: entry.currency,
      categoryId: entry.categoryId,
      note: entry.note,
      startDate: entry.date,
      frequency: 'monthly',
      monthlyDay: parseDate(entry.date).day,
    });
    setIsRecurringModalOpen(true);
  };

  // Add receipt shortcut handler from Undo toast
  const handleAddReceiptShortcut = (entryId: string) => {
    const target = entries.find((e) => e.id === entryId);
    if (target) {
      setEditingEntry(target);
      setIsEntryModalOpen(true);
    }
  };

  // Replace photo on receipt viewer
  const handleReplaceReceiptPhoto = async (entryId: string, file: File) => {
    const target = entries.find((e) => e.id === entryId);
    if (!target) return;

    try {
      const { compressReceiptImage } = await import('./lib/imageCompressor');
      const compressed = await compressReceiptImage(file, 1000, 0.75);
      const updated: FinanceEntry = {
        ...target,
        photoUrl: compressed,
        updatedAt: Date.now(),
      };
      await updateEntry(updated);
      setEntries((prev) => prev.map((e) => (e.id === entryId ? updated : e)));
      setActiveReceiptEntry(updated);
    } catch (err) {
      console.error('Failed to replace photo:', err);
    }
  };

  // Remove photo from receipt viewer
  const handleRemoveReceiptPhoto = async (entryId: string) => {
    const target = entries.find((e) => e.id === entryId);
    if (!target) return;

    const updated: FinanceEntry = {
      ...target,
      photoUrl: undefined,
      updatedAt: Date.now(),
    };
    await updateEntry(updated);
    setEntries((prev) => prev.map((e) => (e.id === entryId ? updated : e)));
    setActiveReceiptEntry(null);
    setIsReceiptModalOpen(false);
  };

  // Sample data actions
  const handleLoadSampleData = async () => {
    const samples = generateSampleEntries(settings.homeCurrency, currentCalendarPeriod.startDate);
    await bulkAddEntries(samples);
    setEntries((prev) => [...samples, ...prev]);
  };

  const handleClearSampleData = async () => {
    await clearSampleEntries();
    setEntries((prev) => prev.filter((e) => !e.isSample));
  };

  // Category CRUD Handlers
  const handleSaveCategory = async (cat: Category) => {
    await saveCategory(cat);
    setCategories((prev) => {
      const idx = prev.findIndex((c) => c.id === cat.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = cat;
        return next;
      }
      return [...prev, cat];
    });
  };

  const handleDeleteCategory = async (catId: string) => {
    const res = await deleteOrArchiveCategory(catId);
    if (res.archived) {
      setCategories((prev) =>
        prev.map((c) => (c.id === catId ? { ...c, isArchived: true } : c))
      );
    } else {
      setCategories((prev) => prev.filter((c) => c.id !== catId));
    }
    return res;
  };

  const handleUnarchiveCategory = async (catId: string) => {
    await unarchiveCategory(catId);
    setCategories((prev) =>
      prev.map((c) => (c.id === catId ? { ...c, isArchived: false } : c))
    );
  };

  // Budget Limits CRUD Handlers
  const handleSaveLimit = async (limit: BudgetLimit) => {
    await saveLimit(limit);
    setLimits((prev) => {
      const idx = prev.findIndex((l) => l.id === limit.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = limit;
        return next;
      }
      return [...prev, limit];
    });
  };

  const handleDeleteLimit = async (limitId: string) => {
    await deleteLimit(limitId);
    setLimits((prev) => prev.filter((l) => l.id !== limitId));
  };

  const handleOpenLimitModal = (type: 'overall' | 'category' = 'overall', categoryId?: string) => {
    setBudgetLimitModalConfig({ type, categoryId });
    setIsBudgetLimitModalOpen(true);
  };

  // Determine active overall budget limit (period override wins over repeating default)
  const activeOverallLimit = useMemo(() => {
    return (
      limits.find((l) => l.type === 'overall' && l.periodId === activePeriod.id) ||
      limits.find((l) => l.type === 'overall' && !l.periodId) ||
      null
    );
  }, [limits, activePeriod.id]);

  // Save Settings handler with home currency recomputation support
  const handleSaveSettings = async (
    updates: Partial<UserSettings>,
    shouldRecomputeHomeCurrency?: boolean
  ) => {
    const next = await saveStoredSettings(updates);
    setSettings(next);

    // If monthStartDay changed, re-anchor the active period
    if (updates.monthStartDay !== undefined && updates.monthStartDay !== settings.monthStartDay) {
      const reanchored = getPeriodForDate(new Date(), updates.monthStartDay);
      setActivePeriod(reanchored);
    }

    // If home currency changed with confirmation, recompute all entries
    if (shouldRecomputeHomeCurrency && updates.homeCurrency) {
      const recomputed = await recomputeAllEntriesForNewHomeCurrency(
        updates.homeCurrency,
        getExchangeRate
      );
      setEntries(recomputed);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col items-center">
      {/* Top Banner if sample data is loaded - slim neutral strip without sparkle icon */}
      {sampleCount > 0 && (
        <div className="w-full bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] py-1.5 px-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-[var(--text-secondary)]">
              Viewing sample demo entries ({sampleCount})
            </span>
            <button
              type="button"
              onClick={handleClearSampleData}
              className="flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--danger)] hover:underline shrink-0"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear sample data</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="w-full max-w-2xl px-4 py-4 sm:py-6 flex flex-col gap-4 pb-40 sm:pb-44">
        {/* Period Navigation Header - on Home only */}
        {activeTab === 'home' && (
          <PeriodHeader
            currentPeriod={currentCalendarPeriod}
            activePeriod={activePeriod}
            onPreviousPeriod={() => {
              setSelectedDateFilter(null);
              handlePreviousPeriod();
            }}
            onNextPeriod={() => {
              setSelectedDateFilter(null);
              handleNextPeriod();
            }}
            onJumpToCurrent={() => {
              setSelectedDateFilter(null);
              handleJumpToCurrent();
            }}
            onOpenGlobalView={() => setIsGlobalViewOpen(true)}
          />
        )}

        {/* Active Tab Content */}
        {activeTab === 'home' && (
          <>
            {/* Due Recurring Occurrences Section */}
            <HomeDueSection
              dueOccurrences={dueOccurrences}
              categories={categories}
              settings={settings}
              onAdd={handleConfirmDueOccurrence}
              onSkip={handleSkipDueOccurrence}
            />

            {entries.length === 0 ? (
              <div className="w-full bg-[var(--bg-surface)] rounded-[28px] p-8 border border-[var(--border-subtle)] flex flex-col items-center justify-center text-center space-y-4 my-2">
                <div className="w-12 h-12 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-2xl text-[var(--accent)]">
                  ✨
                </div>
                <div className="space-y-1.5 max-w-sm">
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    No entries yet
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Add your first entry to see your budget here.
                  </p>
                </div>
                <div className="flex flex-col items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEntry(null);
                      setIsEntryModalOpen(true);
                    }}
                    className="px-6 py-3 text-xs font-semibold rounded-2xl bg-[var(--accent)] text-black hover:opacity-90 shadow-sm transition-opacity cursor-pointer"
                  >
                    Add entry
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadSampleData}
                    className="text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline cursor-pointer pt-1"
                  >
                    Try with sample data
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* 1. Warm Ember Balance Card Hero */}
                <WarmEmberBalanceCard
                  summary={periodSummary}
                  settings={settings}
                  entries={entries}
                  currentEntries={periodEntries}
                  activePeriod={activePeriod}
                  activeOverallLimit={activeOverallLimit}
                  onOpenNewCycleRecap={() => setActiveTab('insights')}
                />

                {/* 2. Rule-Based Top Insight Header */}
                <InsightHeader
                  currentEntries={periodEntries}
                  previousEntries={previousPeriodEntries}
                  categories={categories}
                  settings={settings}
                  activePeriod={activePeriod}
                  limits={limits}
                />

                {/* 3. Daily Spending Rhythm Bar Chart */}
                <DailyBarChart
                  currentEntries={periodEntries}
                  activePeriod={activePeriod}
                  settings={settings}
                  selectedDateFilter={selectedDateFilter}
                  onSelectDateFilter={setSelectedDateFilter}
                />

                {/* 4. Earned vs Spent Horizontal Bars */}
                <EarnedVsSpentWidget
                  entries={entries}
                  settings={settings}
                  currentPeriod={activePeriod}
                />

                {/* 5. Merged Category Breakdown */}
                <CategoryBreakdown
                  entries={periodEntries}
                  previousEntries={previousPeriodEntries}
                  categories={categories}
                  settings={settings}
                  limits={limits}
                  activePeriodId={activePeriod.id}
                  onOpenLimitModal={handleOpenLimitModal}
                  onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
                />

                {/* 6. Period Entries List (Filtered or Full) */}
                <EntryList
                  entries={displayedPeriodEntries}
                  categories={categories}
                  settings={settings}
                  recurringRules={recurringRules}
                  onEdit={(entry) => {
                    setEditingEntry(entry);
                    setIsEntryModalOpen(true);
                  }}
                  onDuplicate={handleDuplicateEntry}
                  onDelete={handleDeleteEntry}
                  onViewReceipt={(entry) => {
                    setActiveReceiptEntry(entry);
                    setIsReceiptModalOpen(true);
                  }}
                  onUpdateRate={handleUpdateEntryRate}
                  onOpenRecurring={handleOpenRecurringFromEntry}
                />
              </>
            )}
          </>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight">History</h2>
            <EntryList
              entries={entries}
              categories={categories}
              settings={settings}
              recurringRules={recurringRules}
              onEdit={(entry) => {
                setEditingEntry(entry);
                setIsEntryModalOpen(true);
              }}
              onDuplicate={handleDuplicateEntry}
              onDelete={handleDeleteEntry}
              onViewReceipt={(entry) => {
                setActiveReceiptEntry(entry);
                setIsReceiptModalOpen(true);
              }}
              onUpdateRate={handleUpdateEntryRate}
              onOpenRecurring={handleOpenRecurringFromEntry}
              showSearch={true}
            />
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-6">
            <div className="bg-[var(--bg-surface)] rounded-[28px] p-6 border border-[var(--border-subtle)] space-y-3">
              <h2 className="text-base font-bold">Cycle Recap & Trajectory</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Review your multi-cycle spending behavior, category shifts, and financial trajectory over time.
              </p>
            </div>
            <EarnedVsSpentWidget
              entries={entries}
              settings={settings}
              currentPeriod={activePeriod}
            />
            <CategoryBreakdown
              entries={periodEntries}
              previousEntries={previousPeriodEntries}
              categories={categories}
              settings={settings}
              limits={limits}
              activePeriodId={activePeriod.id}
              onOpenLimitModal={handleOpenLimitModal}
              onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
            />
          </div>
        )}

        {activeTab === 'settings' && (
          isRecurringPageOpen ? (
            <RecurringPage
              onBack={() => setIsRecurringPageOpen(false)}
              rules={recurringRules}
              categories={categories}
              settings={settings}
              onSaveRule={handleSaveRecurringRule}
              onDeleteRule={handleDeleteRecurringRule}
            />
          ) : isBudgetLimitsPageOpen ? (
            <BudgetLimitsPage
              onBack={() => setIsBudgetLimitsPageOpen(false)}
              activePeriod={activePeriod}
              categories={categories}
              limits={limits}
              settings={settings}
              entries={entries}
              onSaveLimit={handleSaveLimit}
              onDeleteLimit={handleDeleteLimit}
            />
          ) : (
            <SettingsView
              settings={settings}
              onSaveSettings={handleSaveSettings}
              categories={categories}
              limits={limits}
              recurringCount={recurringRules.length}
              sampleCount={sampleCount}
              onLoadSampleData={handleLoadSampleData}
              onClearSampleData={handleClearSampleData}
              theme={theme}
              onToggleTheme={handleToggleTheme}
              onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
              onOpenBudgetLimitsPage={() => setIsBudgetLimitsPageOpen(true)}
              onOpenRecurringPage={() => setIsRecurringPageOpen(true)}
              onShowWelcomeAgain={() => setIsWelcomeOpen(true)}
              onReloadData={loadData}
            />
          )
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
        }}
        onOpenAddModal={() => {
          setEditingEntry(null);
          setIsEntryModalOpen(true);
        }}
      />

      {/* Entry Modal with Large Numpad & 2-Tap Category Logging */}
      <EntryModal
        isOpen={isEntryModalOpen}
        onClose={() => {
          setIsEntryModalOpen(false);
          setEditingEntry(null);
        }}
        onSave={handleSaveEntry}
        categories={categories}
        settings={settings}
        editingEntry={editingEntry}
        onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
      />

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        categories={categories}
        onSaveCategory={handleSaveCategory}
        onDeleteCategory={handleDeleteCategory}
        onUnarchiveCategory={handleUnarchiveCategory}
      />

      {/* Budget Limit Modal */}
      <BudgetLimitModal
        isOpen={isBudgetLimitModalOpen}
        onClose={() => setIsBudgetLimitModalOpen(false)}
        activePeriod={activePeriod}
        categories={categories}
        limits={limits}
        settings={settings}
        onSaveLimit={handleSaveLimit}
        onDeleteLimit={handleDeleteLimit}
        initialType={budgetLimitModalConfig.type}
        initialCategoryId={budgetLimitModalConfig.categoryId}
      />

      {/* Receipt Viewer & Photo Management Modal */}
      <ReceiptModal
        entry={activeReceiptEntry}
        category={categories.find((c) => c.id === activeReceiptEntry?.categoryId)}
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setActiveReceiptEntry(null);
        }}
        onRemovePhoto={handleRemoveReceiptPhoto}
        onReplacePhoto={handleReplaceReceiptPhoto}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        sampleCount={sampleCount}
        onLoadSampleData={handleLoadSampleData}
        onClearSampleData={handleClearSampleData}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
        onOpenLimitModal={() => handleOpenLimitModal('overall')}
      />

      {/* Global View Modal */}
      <GlobalViewModal
        isOpen={isGlobalViewOpen}
        onClose={() => setIsGlobalViewOpen(false)}
        entries={entries}
        settings={settings}
        currentPeriod={currentCalendarPeriod}
        onSelectPeriod={(period) => setActivePeriod(period)}
      />

      {/* Reversible Undo Toast */}
      <UndoToast
        action={undoAction}
        onUndo={handleUndo}
        onDismiss={() => setUndoAction(null)}
        onAddReceiptShortcut={handleAddReceiptShortcut}
      />

      {/* PWA Version Update Toast */}
      <PWAUpdateToast
        show={updateAvailable && !dismissedUpdateToast}
        onReload={reloadApp}
        onDismiss={() => setDismissedUpdateToast(true)}
      />

      {/* Recurring Entry Modal */}
      <RecurringModal
        isOpen={isRecurringModalOpen}
        onClose={() => {
          setIsRecurringModalOpen(false);
          setEditingRecurringRule(null);
          setRecurringModalInitialData(undefined);
        }}
        editingRule={editingRecurringRule}
        initialData={recurringModalInitialData}
        categories={categories}
        settings={settings}
        onSave={handleSaveRecurringRule}
        onDelete={handleDeleteRecurringRule}
      />

      {/* Welcome Modal */}
      <WelcomeModal
        isOpen={isWelcomeOpen && (isSettingsLoaded || storageUnavailable)}
        onClose={handleCloseWelcome}
        onGetStarted={handleGetStartedWelcome}
        currentSettings={settings}
        isSettingsLoaded={isSettingsLoaded}
      />
    </div>
  );
}
