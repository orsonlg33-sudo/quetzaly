/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserSettings, Category, BudgetLimit } from '../types/finance';
import { getCurrencyName, formatCents } from '../lib/currency';
import { CurrencyPickerSheet } from './CurrencyPickerSheet';
import { ChevronRight, Check, X } from 'lucide-react';
import { AdaptiveModal, AdaptiveModalActions } from './AdaptiveModal';
import { exportDatabase, validateBackup, importDatabase } from '../lib/db';
import { usePWA } from '../hooks/usePWA';

interface SettingsViewProps {
  settings: UserSettings;
  onSaveSettings: (updates: Partial<UserSettings>, shouldRecomputeHomeCurrency?: boolean) => void;
  categories: Category[];
  limits: BudgetLimit[];
  recurringCount?: number;
  sampleCount: number;
  onLoadSampleData: () => void;
  onClearSampleData: () => void;
  theme: string;
  onToggleTheme: () => void;
  onOpenCategoryManager: () => void;
  onOpenBudgetLimitsPage: () => void;
  onOpenRecurringPage?: () => void;
  onShowWelcomeAgain?: () => void;
  onReloadData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  categories,
  limits,
  recurringCount = 0,
  sampleCount,
  onLoadSampleData,
  onClearSampleData,
  theme,
  onToggleTheme,
  onOpenCategoryManager,
  onOpenBudgetLimitsPage,
  onOpenRecurringPage,
  onShowWelcomeAgain,
  onReloadData,
}) => {
  const [isEditSetupOpen, setIsEditSetupOpen] = useState<boolean>(false);
  const { isInstallable, isInstalled, isIOS, installApp } = usePWA();
  const [startDay, setStartDay] = useState<number>(settings.monthStartDay || 22);
  const [homeCurrency, setHomeCurrency] = useState<string>(settings.homeCurrency || 'MXN');
  const [rolloverEnabled, setRolloverEnabled] = useState<boolean>(settings.rolloverEnabled || false);
  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importInlineError, setImportInlineError] = useState<string | null>(null);
  const [importBackupData, setImportBackupData] = useState<any>(null);
  const [includePhotos, setIncludePhotos] = useState<boolean>(false);
  const [exportSize, setExportSize] = useState<number>(0);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const handleOpenExportModal = async () => {
    setIncludePhotos(false);
    const { estimatedSizeKb } = await exportDatabase(false);
    setExportSize(estimatedSizeKb);
    setIsExportModalOpen(true);
  };

  const handleToggleIncludePhotos = async () => {
    const next = !includePhotos;
    setIncludePhotos(next);
    const { estimatedSizeKb } = await exportDatabase(next);
    setExportSize(estimatedSizeKb);
  };

  const handleDownloadBackup = async () => {
    const { backup } = await exportDatabase(includePhotos);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const a = document.createElement('a');
    a.href = url;
    a.download = `quetzaly-backup-${yyyy}-${mm}-${dd}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setIsExportModalOpen(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let backup: any;
        try {
          backup = JSON.parse(event.target?.result as string);
        } catch {
          const err = "This file isn't a valid backup. Choose a file exported from Quetzaly.";
          setImportError(err);
          setImportInlineError(err);
          setImportBackupData(null);
          setIsImportModalOpen(true);
          return;
        }

        const validation = validateBackup(backup);
        if (!validation.valid) {
          const err = validation.error || "The import didn't finish and nothing was changed.";
          setImportError(err);
          setImportInlineError(err);
          setImportBackupData(null);
          setIsImportModalOpen(true);
          return;
        }

        setImportBackupData(backup);
        setImportError(null);
        setImportInlineError(null);
        setShowReplaceConfirm(false);
        setIsImportModalOpen(true);
      } catch {
        const err = "The import didn't finish and nothing was changed.";
        setImportError(err);
        setImportInlineError(err);
        setImportBackupData(null);
        setIsImportModalOpen(true);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.onerror = () => {
      const err = "The import didn't finish and nothing was changed.";
      setImportError(err);
      setImportInlineError(err);
      setImportBackupData(null);
      setIsImportModalOpen(true);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handlePerformImport = async (mode: 'replace' | 'merge') => {
    if (!importBackupData) return;
    try {
      const count = await importDatabase(importBackupData, mode);
      setIsImportModalOpen(false);
      setShowReplaceConfirm(false);
      setImportBackupData(null);
      setToastMessage(count === 1 ? 'Imported 1 entry' : `Imported ${count} entries`);
      onReloadData();
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message;
      setImportError(
        msg && (msg.includes('valid backup') || msg.includes('exported from') || msg.includes('newer version') || msg.includes('home currency'))
          ? msg
          : "The import didn't finish and nothing was changed."
      );
    }
  };

  const summaryDate = React.useMemo(() => {
    if (!importBackupData?.exportedAt) return 'recently';
    const d = new Date(importBackupData.exportedAt);
    if (isNaN(d.getTime())) return 'recently';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, [importBackupData]);

  const summaryCounts = React.useMemo(() => {
    if (!importBackupData?.data) return '';
    const entriesCount = importBackupData.data.entries?.length || 0;
    const catsCount = importBackupData.data.categories?.length || 0;
    const limitsCount = importBackupData.data.limits?.length || 0;
    const recCount = importBackupData.data.recurring?.length || 0;
    return `${entriesCount} entries, ${catsCount} categories, ${limitsCount} limits, ${recCount} recurring rules, exported ${summaryDate}`;
  }, [importBackupData, summaryDate]);

  // Overall limit
  const overallLimit = limits.find((l) => l.type === 'overall');

  // Summary sentence
  const rawCurrencyName = getCurrencyName(settings.homeCurrency);
  const currencyName = rawCurrencyName.charAt(0).toUpperCase() + rawCurrencyName.slice(1);

  const getOrdinalSuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1:  return 'st';
      case 2:  return 'nd';
      case 3:  return 'rd';
      default: return 'th';
    }
  };

  const startDayText = `cycles start on the ${settings.monthStartDay}${getOrdinalSuffix(settings.monthStartDay)}`;
  const limitText = overallLimit ? `, ${formatCents(overallLimit.amount, settings.homeCurrency)} limit` : '';
  const rolloverText = `, rollover ${settings.rolloverEnabled ? 'on' : 'off'}`;
  const setupSentence = `${currencyName}, ${startDayText}${limitText}${rolloverText}`;

  const handleSaveSetup = () => {
    const isCurrencyChanging = homeCurrency.toUpperCase() !== settings.homeCurrency.toUpperCase();
    onSaveSettings(
      {
        monthStartDay: startDay,
        homeCurrency,
        rolloverEnabled,
      },
      isCurrencyChanging
    );
    setIsEditSetupOpen(false);
  };

  // Live preview for Edit Setup: calculate next cycle dates
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, startDay);
  const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, startDay - 1);
  const nextCycleStr = `${now.toLocaleDateString('en-US', { month: 'short' })} ${startDay} – ${nextMonth.toLocaleDateString('en-US', { month: 'short' })} ${startDay - 1 > 0 ? startDay - 1 : 28}`;

  return (
    <div className="w-full space-y-6 pb-12 animate-in fade-in duration-150">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
      </div>

      {/* Your Setup Card */}
      <div className="bg-[var(--bg-surface)] rounded-[28px] p-6 border border-[var(--border-subtle)] space-y-4">
        <div>
          <span className="text-[11px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase block mb-1">
            Your setup
          </span>
          <p className="text-base font-medium text-[var(--text-primary)] leading-relaxed">
            {setupSentence}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setStartDay(settings.monthStartDay || 22);
            setHomeCurrency(settings.homeCurrency || 'MXN');
            setRolloverEnabled(settings.rolloverEnabled || false);
            setIsEditSetupOpen(true);
          }}
          className="text-xs font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1 cursor-pointer"
        >
          Edit setup
        </button>
      </div>

      {/* Organize & App Sections */}
      <div className="space-y-6">
        <div>
          <span className="text-[11px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase px-1 block mb-2">
            Organize
          </span>
          <div className="bg-[var(--bg-surface)] rounded-[28px] border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden">
            <button
              type="button"
              onClick={onOpenCategoryManager}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--bg-elevated)]/40 transition-colors cursor-pointer"
            >
              <span className="text-sm font-medium text-[var(--text-primary)]">Categories</span>
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <span>{categories.length}</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            <button
              type="button"
              onClick={onOpenBudgetLimitsPage}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--bg-elevated)]/40 transition-colors cursor-pointer"
            >
              <span className="text-sm font-medium text-[var(--text-primary)]">Budget limits</span>
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <span>
                  {overallLimit ? '1 overall' : '0 overall'}, {limits.filter((l) => l.type === 'category').length} categories
                </span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            {onOpenRecurringPage && (
              <button
                type="button"
                onClick={onOpenRecurringPage}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--bg-elevated)]/40 transition-colors cursor-pointer"
              >
                <span className="text-sm font-medium text-[var(--text-primary)]">Recurring</span>
                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <span>{recurringCount}</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            )}
          </div>
        </div>

        <div>
          <span className="text-[11px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase px-1 block mb-2">
            App
          </span>
          <div className="bg-[var(--bg-surface)] rounded-[28px] border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden">
            <button
              type="button"
              onClick={onToggleTheme}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--bg-elevated)]/40 transition-colors cursor-pointer"
            >
              <span className="text-sm font-medium text-[var(--text-primary)]">Appearance</span>
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                if (sampleCount > 0) {
                  onClearSampleData();
                } else {
                  onLoadSampleData();
                }
              }}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--bg-elevated)]/40 transition-colors cursor-pointer"
            >
              <span className="text-sm font-medium text-[var(--text-primary)]">Sample data</span>
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <span>{sampleCount > 0 ? 'On' : 'Off'}</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            <button
              type="button"
              onClick={onShowWelcomeAgain}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--bg-elevated)]/40 transition-colors cursor-pointer"
            >
              <span className="text-sm font-medium text-[var(--text-primary)]">Show welcome again</span>
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>

            {!isInstalled && (isInstallable || isIOS) && (
              isInstallable ? (
                <button
                  type="button"
                  onClick={() => installApp()}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--bg-elevated)]/40 transition-colors cursor-pointer"
                >
                  <span className="text-sm font-medium text-[var(--text-primary)]">Install app</span>
                  <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
                </button>
              ) : isIOS ? (
                <div className="w-full flex items-center justify-between p-4 text-left">
                  <span className="text-sm font-medium text-[var(--text-primary)]">Install app</span>
                  <span className="text-xs text-[var(--text-secondary)]">Tap Share, then Add to Home Screen</span>
                </div>
              ) : null
            )}
          </div>
        </div>

        <div>
          <span className="text-[11px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase px-1 block mb-2">
            Backup
          </span>
          <div className="bg-[var(--bg-surface)] rounded-[28px] border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden">
            <button
              type="button"
              onClick={handleOpenExportModal}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--bg-elevated)]/40 transition-colors cursor-pointer"
            >
              <span className="text-sm font-medium text-[var(--text-primary)]">Export backup</span>
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>

            <label className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--bg-elevated)]/40 transition-colors cursor-pointer">
              <span className="text-sm font-medium text-[var(--text-primary)]">Import backup</span>
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          </div>
          {importInlineError && (
            <p className="text-xs text-red-500 font-medium px-2 mt-2">{importInlineError}</p>
          )}
        </div>
      </div>

      {/* Rates Credit */}
      <div className="pt-4 text-center text-[11px] text-[var(--text-secondary)]">
        <span>Rates by </span>
        <a
          href="https://api.frankfurter.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent)] underline"
        >
          Frankfurter
        </a>
        <span> & </span>
        <a
          href="https://www.exchangerate-api.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent)] underline"
        >
          ExchangeRate-API
        </a>
      </div>

      {/* Edit Setup Bottom Sheet / Centred Dialog */}
      <AdaptiveModal
        id="settings_view_edit_setup"
        isOpen={isEditSetupOpen}
        onClose={() => setIsEditSetupOpen(false)}
      >
        {/* Scrollable content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
          {/* Header: "Your setup" on left, "Cancel" on right */}
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
            <h3 className="text-base font-bold text-[var(--text-primary)]">Your setup</h3>
            <button
              type="button"
              onClick={() => setIsEditSetupOpen(false)}
              className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Cancel
            </button>
          </div>

          {/* Home currency as a plain row ("Mexican peso MXN ›") */}
          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            className="w-full flex items-center justify-between py-2 text-left cursor-pointer"
          >
            <span className="text-xs font-medium text-[var(--text-primary)]">Home currency</span>
            <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
              <span>{getCurrencyName(homeCurrency)} {homeCurrency}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>

          {/* Cycle starts on the Xth + 1-31 Day Grid */}
          <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
            <span className="text-xs font-semibold text-[var(--text-primary)] block">
              Cycle starts on the <strong className="text-[var(--accent)]">{startDay}{getOrdinalSuffix(startDay)}</strong>
            </span>

            {/* 1–31 Day Grid (7 columns) */}
            <div className="grid grid-cols-7 gap-1.5 select-none pt-1">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                const isSelected = startDay === day;
                return (
                  <button
                    key={`day_${day}`}
                    type="button"
                    onClick={() => setStartDay(day)}
                    className={`h-9 rounded-xl text-xs font-semibold transition-all flex items-center justify-center cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--accent)] text-black dark:text-black font-bold shadow-sm'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/75'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Live preview line */}
            <p className="text-[11px] text-[var(--text-secondary)] pt-1">
              Next cycle: {nextCycleStr}. Short months start on their last day.
            </p>
          </div>

          {/* Rollover Toggle */}
          <div className="flex items-center justify-between py-3 border-t border-[var(--border-subtle)]">
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)]">Roll over leftovers</p>
              <p className="text-[11px] text-[var(--text-secondary)]">Add what&apos;s left to the next cycle</p>
            </div>
            <button
              type="button"
              onClick={() => setRolloverEnabled(!rolloverEnabled)}
              className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer ${
                rolloverEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--border-subtle)]'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${
                  rolloverEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Pinned Save Button Container */}
        <AdaptiveModalActions>
          <button
            type="button"
            onClick={handleSaveSetup}
            className="w-full py-3.5 text-xs font-semibold rounded-2xl bg-[var(--accent)] text-black dark:text-black shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
          >
            Save
          </button>
        </AdaptiveModalActions>
      </AdaptiveModal>

      {/* Export Modal */}
      <AdaptiveModal
        id="settings_view_export"
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      >
        <div className="flex items-center justify-between p-6 pb-2 border-b border-[var(--border-subtle)] shrink-0">
          <h3 className="text-base font-bold text-[var(--text-primary)]">Export backup</h3>
          <button
            type="button"
            onClick={() => setIsExportModalOpen(false)}
            className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)]">Include receipt photos</p>
              <p className="text-[11px] text-[var(--text-secondary)]">Adds photos to the backup file</p>
            </div>
            <button
              type="button"
              onClick={handleToggleIncludePhotos}
              className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                includePhotos ? 'bg-[var(--accent)]' : 'bg-[var(--border-subtle)]'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${
                  includePhotos ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between text-xs py-1">
            <span className="text-[var(--text-secondary)]">Estimated file size</span>
            <span className="font-semibold text-[var(--text-primary)] tabular-nums">~{exportSize} KB</span>
          </div>
        </div>

        <AdaptiveModalActions>
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="w-full py-3.5 text-xs font-semibold rounded-2xl bg-[var(--accent)] text-black dark:text-black shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
          >
            Download backup
          </button>
        </AdaptiveModalActions>
      </AdaptiveModal>

      {/* Import Modal */}
      <AdaptiveModal
        id="settings_view_import"
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setShowReplaceConfirm(false);
        }}
      >
        <div className="flex items-center justify-between p-6 pb-2 border-b border-[var(--border-subtle)] shrink-0">
          <h3 className="text-base font-bold text-[var(--text-primary)]">Import backup</h3>
          <button
            type="button"
            onClick={() => {
              setIsImportModalOpen(false);
              setShowReplaceConfirm(false);
            }}
            className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          {importError ? (
            <div className="py-2 space-y-2">
              <p className="text-xs text-red-500 font-medium leading-relaxed">{importError}</p>
            </div>
          ) : importBackupData ? (
            <>
              <p className="text-xs font-medium text-[var(--text-secondary)] leading-relaxed">
                {summaryCounts}
              </p>

              {(() => {
                const backupHomeCurrency = (importBackupData?.data?.settings?.homeCurrency || '').toUpperCase();
                const deviceHomeCurrency = (settings.homeCurrency || '').toUpperCase();
                const isCurrencyDifferent = Boolean(
                  backupHomeCurrency && deviceHomeCurrency && backupHomeCurrency !== deviceHomeCurrency
                );

                return (
                  <>
                    {isCurrencyDifferent && (
                      <div className="p-3.5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1 text-left">
                        <p className="text-xs font-semibold text-[var(--text-primary)]">
                          This backup uses {backupHomeCurrency} as its home currency. This device uses {deviceHomeCurrency}.
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                          Merge is disabled to prevent mixing different currencies. Replace will restore {backupHomeCurrency} and all data.
                        </p>
                      </div>
                    )}

                    {showReplaceConfirm ? (
                      <div className="space-y-4 pt-2">
                        <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 space-y-1">
                          <p className="text-xs font-semibold text-red-500">Are you sure?</p>
                          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                            This will permanently erase all data on this device and replace it with this backup. This cannot be undone.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 pt-2">
                        <button
                          type="button"
                          disabled={isCurrencyDifferent}
                          onClick={() => !isCurrencyDifferent && handlePerformImport('merge')}
                          className={`w-full p-4 rounded-2xl text-left transition-colors border space-y-0.5 ${
                            isCurrencyDifferent
                              ? 'opacity-40 cursor-not-allowed bg-[var(--bg-elevated)]/50 border-[var(--border-subtle)]'
                              : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated)]/75 cursor-pointer border-[var(--border-subtle)]'
                          }`}
                        >
                          <span className="block text-xs font-semibold text-[var(--text-primary)]">
                            Merge into current data
                          </span>
                          <span className="block text-[11px] text-[var(--text-secondary)]">
                            {isCurrencyDifferent
                              ? 'Unavailable: currencies differ between backup and device.'
                              : "Adds entries from backup without deleting what's already here."}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowReplaceConfirm(true)}
                          className="w-full p-4 rounded-2xl hover:bg-red-500/5 text-left transition-colors cursor-pointer border border-red-500/30 space-y-0.5"
                        >
                          <span className="block text-xs font-semibold text-red-500">
                            Replace everything on this device
                          </span>
                          <span className="block text-[11px] text-[var(--text-secondary)]">
                            Erases all current data and restores exactly what is in this backup.
                          </span>
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          ) : (
            <p className="text-xs text-[var(--text-secondary)]">The import didn&apos;t finish and nothing was changed.</p>
          )}
        </div>

        <AdaptiveModalActions>
          {importError ? (
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="w-full py-3.5 text-xs font-semibold rounded-2xl bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/75 cursor-pointer"
            >
              Close
            </button>
          ) : showReplaceConfirm ? (
            <div className="space-y-2 w-full">
              <button
                type="button"
                onClick={() => handlePerformImport('replace')}
                className="w-full py-3.5 text-xs font-semibold rounded-2xl bg-red-500 text-white shadow-sm cursor-pointer hover:bg-red-600 transition-colors"
              >
                Yes, replace everything
              </button>
              <button
                type="button"
                onClick={() => setShowReplaceConfirm(false)}
                className="w-full py-3 text-xs font-semibold rounded-2xl bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/75 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : null}
        </AdaptiveModalActions>
      </AdaptiveModal>

      {/* In-app Toast */}
      {toastMessage && (
        <div
          className="fixed z-50 left-1/2 -translate-x-1/2 pointer-events-auto transition-all animate-in fade-in slide-in-from-bottom-3 duration-200"
          style={{
            bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div className="bg-[#2C2523] dark:bg-[#1F1A18] text-[#FBF9F5] rounded-2xl shadow-xl border border-white/10 px-4 py-3 flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-semibold text-white">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Currency Picker Sheet */}
      <CurrencyPickerSheet
        id="currency_picker_settings_view"
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        selectedCurrency={homeCurrency}
        homeCurrency={settings.homeCurrency}
        recentCurrencies={settings.recentCurrencies || []}
        onSelect={(code) => setHomeCurrency(code)}
        title="Currency"
      />
    </div>
  );
};
