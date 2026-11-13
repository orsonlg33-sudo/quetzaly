/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Calendar,
  DollarSign,
  HardDrive,
  Trash2,
  Sparkles,
  Moon,
  Sun,
  AlertTriangle,
  ChevronDown,
  Tag,
  Target,
} from 'lucide-react';
import { UserSettings } from '../types/finance';
import { getCurrencyName, getCurrencySymbol } from '../lib/currency';
import { requestPersistentStorage } from '../lib/db';
import { CurrencyPickerSheet } from './CurrencyPickerSheet';

import { AdaptiveModal } from './AdaptiveModal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSaveSettings: (updates: Partial<UserSettings>, shouldRecomputeHomeCurrency?: boolean) => void;
  sampleCount: number;
  onLoadSampleData: () => void;
  onClearSampleData: () => void;
  theme: string;
  onToggleTheme: () => void;
  onOpenCategoryManager?: () => void;
  onOpenLimitModal?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  sampleCount,
  onLoadSampleData,
  onClearSampleData,
  theme,
  onToggleTheme,
  onOpenCategoryManager,
  onOpenLimitModal,
}) => {
  const [startDay, setStartDay] = useState<number>(settings.monthStartDay || 22);
  const [homeCurrency, setHomeCurrency] = useState<string>(settings.homeCurrency || 'MXN');
  const [rolloverEnabled, setRolloverEnabled] = useState<boolean>(settings.rolloverEnabled || false);
  const [isPersisted, setIsPersisted] = useState<boolean>(false);
  const [showCurrencyConfirm, setShowCurrencyConfirm] = useState<boolean>(false);
  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setStartDay(settings.monthStartDay || 22);
      setHomeCurrency(settings.homeCurrency || 'MXN');
      setRolloverEnabled(settings.rolloverEnabled || false);
      setShowCurrencyConfirm(false);

      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
        navigator.storage.persisted().then(setIsPersisted).catch(() => {});
      }
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const isCurrencyChanging = homeCurrency.toUpperCase() !== settings.homeCurrency.toUpperCase();

  const handleApplyChanges = () => {
    if (isCurrencyChanging) {
      setShowCurrencyConfirm(true);
      return;
    }

    onSaveSettings({
      monthStartDay: startDay,
      homeCurrency,
      rolloverEnabled,
    });
    onClose();
  };

  const handleConfirmCurrencyChange = () => {
    onSaveSettings(
      {
        monthStartDay: startDay,
        homeCurrency,
        rolloverEnabled,
      },
      true // flag to recompute home amounts
    );
    setShowCurrencyConfirm(false);
    onClose();
  };

  const handleRequestPersistence = async () => {
    const success = await requestPersistentStorage();
    setIsPersisted(success);
  };

  return (
    <>
      <AdaptiveModal
      id="settings_modal"
      isOpen={isOpen}
      onClose={onClose}
    >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2C2523]/8 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-2xl bg-[#C85A32]/15 text-[#C85A32] flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-[#2C2523] dark:text-[#F7F4F0]">
              Settings & Preferences
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[#706764] hover:text-[#2C2523] dark:text-[#B5ADA9] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Currency Change Confirmation Alert */}
          {showCurrencyConfirm && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    Change Home Currency to {homeCurrency}?
                  </p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                    All original logged transaction amounts and currencies will remain completely intact. Your converted home amounts will be safely recomputed with current exchange rates.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCurrencyConfirm(false)}
                  className="px-3 py-1.5 text-xs font-medium rounded-xl text-[#706764] dark:text-[#B5ADA9] hover:bg-black/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCurrencyChange}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#C85A32] text-white hover:bg-[#B54D27]"
                >
                  Confirm & Recompute
                </button>
              </div>
            </div>
          )}

          {/* Theme Switch */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FBF9F5] dark:bg-[#191514] border border-[#2C2523]/6 dark:border-white/5">
            <div className="flex items-center gap-2.5">
              {theme === 'dark' ? (
                <Moon className="w-4 h-4 text-[#C85A32]" />
              ) : (
                <Sun className="w-4 h-4 text-[#C85A32]" />
              )}
              <div>
                <p className="text-xs font-semibold text-[#2C2523] dark:text-[#F7F4F0]">
                  Appearance
                </p>
                <p className="text-[11px] text-[#706764] dark:text-[#B5ADA9]">
                  {theme === 'dark' ? 'Warm Dark Basalt' : 'Soft Terracotta Stone'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleTheme}
              className="px-3 py-1.5 text-xs font-medium rounded-xl bg-[#F5EFE9] dark:bg-[#2C2624] text-[#2C2523] dark:text-[#F7F4F0] hover:bg-[#E8E2D9] transition-colors"
            >
              Toggle {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>

          {/* Month Starts on Day X */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#2C2523] dark:text-[#F7F4F0] flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#C85A32]" />
                Month starts on day: <strong className="text-[#C85A32] ml-1">{startDay}</strong>
              </label>
              <span className="text-[11px] text-[#706764] dark:text-[#B5ADA9]">
                (Default: 22)
              </span>
            </div>

            <input
              type="range"
              min="1"
              max="31"
              value={startDay}
              onChange={(e) => setStartDay(Number(e.target.value))}
              className="w-full accent-[#C85A32] cursor-pointer"
            />

            <div className="flex items-center justify-between text-[10px] text-[#706764] dark:text-[#B5ADA9] px-0.5">
              <span>Day 1 (Calendar)</span>
              <span>Day 15 (Mid-month)</span>
              <span>Day 22 (Default)</span>
              <span>Day 31 (Month-end)</span>
            </div>

            <p className="text-[11px] text-[#706764] dark:text-[#B5ADA9] bg-[#F5EFE9] dark:bg-[#2C2624] p-2.5 rounded-xl">
              💡 If a month has fewer days than day {startDay} (such as February having 28/29 days or April having 30), the period automatically starts on that month&apos;s last day without leaving gaps or overlaps.
            </p>
          </div>

          {/* Home Currency */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#2C2523] dark:text-[#F7F4F0] flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-[#C85A32]" />
              Home Currency
            </label>
            {/* Searchable Currency Picker Trigger */}
            <button
              type="button"
              onClick={() => setIsPickerOpen(true)}
              className="w-full px-3.5 py-3 text-xs rounded-2xl bg-[#F5EFE9] dark:bg-[#2C2624] text-[#2C2523] dark:text-[#F7F4F0] border border-[#2C2523]/10 dark:border-white/10 flex items-center justify-between hover:bg-[#E8E2D9] dark:hover:bg-[#3A3230] transition-colors text-left"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="font-bold tabular-nums text-sm">{homeCurrency}</span>
                <span className="text-[#706764] dark:text-[#B5ADA9] truncate">
                  · {getCurrencyName(homeCurrency)} ({getCurrencySymbol(homeCurrency)})
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-[#706764] shrink-0 ml-2" />
            </button>
            <p className="text-[11px] text-[#706764] dark:text-[#B5ADA9]">
              Home currency is changed only here. Logging an entry in another currency converts to this home currency.
            </p>
          </div>

          {/* Rollover Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FBF9F5] dark:bg-[#191514] border border-[#2C2523]/6 dark:border-white/5">
            <div className="pr-4">
              <p className="text-xs font-semibold text-[#2C2523] dark:text-[#F7F4F0]">
                Roll over leftover balance
              </p>
              <p className="text-[11px] text-[#706764] dark:text-[#B5ADA9] mt-0.5">
                {rolloverEnabled
                  ? 'ON: Leftover from previous cycles is added to this cycle&apos;s starting budget.'
                  : 'OFF: Each period starts fresh at zero; carried over amount is shown on a separate line.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setRolloverEnabled(!rolloverEnabled)}
              className={`w-12 h-7 rounded-full transition-colors relative shrink-0 ${
                rolloverEnabled ? 'bg-[#C85A32]' : 'bg-[#E8E2D9] dark:bg-[#3A3230]'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  rolloverEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Category Management Shortcut */}
          {onOpenCategoryManager && (
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FBF9F5] dark:bg-[#191514] border border-[#2C2523]/6 dark:border-white/5">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-[#C85A32]/15 text-[#C85A32] flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-[#2C2523] dark:text-[#F7F4F0]">
                    Manage Categories
                  </p>
                  <p className="text-[11px] text-[#706764] dark:text-[#B5ADA9]">
                    Add, edit emoji/color, or safely archive
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onOpenCategoryManager();
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#F5EFE9] dark:bg-[#2C2624] text-[#C85A32] hover:bg-[#E8E2D9] transition-colors"
              >
                Manage
              </button>
            </div>
          )}

          {/* Budget Limits Shortcut */}
          {onOpenLimitModal && (
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FBF9F5] dark:bg-[#191514] border border-[#2C2523]/6 dark:border-white/5">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-[#3D7B5E]/15 text-[#3D7B5E] flex items-center justify-center">
                  <Target className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-[#2C2523] dark:text-[#F7F4F0]">
                    Budget Limits
                  </p>
                  <p className="text-[11px] text-[#706764] dark:text-[#B5ADA9]">
                    Set overall cycle and category limits
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onOpenLimitModal();
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#F5EFE9] dark:bg-[#2C2624] text-[#3D7B5E] hover:bg-[#E8E2D9] transition-colors"
              >
                Configure
              </button>
            </div>
          )}

          {/* Sample Data Management */}
          <div className="p-3.5 rounded-2xl bg-[#F5EFE9] dark:bg-[#2C2624] space-y-2 border border-[#2C2523]/8 dark:border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#2C2523] dark:text-[#F7F4F0] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#C85A32]" />
                Sample Test Data
              </span>
              <span className="text-[11px] text-[#706764] dark:text-[#B5ADA9]">
                {sampleCount > 0 ? `${sampleCount} sample entries` : 'None loaded'}
              </span>
            </div>

            <p className="text-[11px] text-[#706764] dark:text-[#B5ADA9]">
              Load friendly realistic sample entries to test the cycle calculations and category charts, or clear them anytime with one tap.
            </p>

            <div className="flex items-center gap-2 pt-1">
              {sampleCount > 0 ? (
                <button
                  type="button"
                  onClick={onClearSampleData}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-rose-600 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear sample data</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onLoadSampleData}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-[#2C2523] dark:text-[#F7F4F0] bg-white dark:bg-[#191514] border border-[#2C2523]/10 hover:bg-[#FBF9F5] transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#C85A32]" />
                  <span>Restore sample data</span>
                </button>
              )}
            </div>
          </div>

          {/* Storage & Offline Status */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[#FBF9F5] dark:bg-[#191514] border border-[#2C2523]/6 dark:border-white/5 text-xs">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[#706764] dark:text-[#B5ADA9]" />
              <div>
                <p className="font-semibold text-[#2C2523] dark:text-[#F7F4F0]">
                  IndexedDB Storage
                </p>
                <p className="text-[10px] text-[#706764] dark:text-[#B5ADA9]">
                  {isPersisted ? 'Persistent storage granted' : 'Client-side storage active'}
                </p>
              </div>
            </div>

            {!isPersisted && (
              <button
                type="button"
                onClick={handleRequestPersistence}
                className="text-[11px] font-semibold text-[#C85A32] hover:underline"
              >
                Request persist
              </button>
            )}
          </div>

          {/* Exchange Rates API Attribution Credit */}
          <div className="pt-2 text-center text-[11px] text-[#706764] dark:text-[#B5ADA9]">
            <span>Rates by </span>
            <a
              href="https://api.frankfurter.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#C85A32] underline hover:opacity-80"
            >
              Frankfurter
            </a>
            <span> & </span>
            <a
              href="https://www.exchangerate-api.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#C85A32] underline hover:opacity-80"
            >
              ExchangeRate-API
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-white dark:bg-[#231E1C] border-t border-[#2C2523]/8 dark:border-white/10 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-xl text-[#706764] dark:text-[#B5ADA9] hover:bg-black/5 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApplyChanges}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-[#C85A32] hover:bg-[#B54D27] text-white shadow-sm transition-colors"
          >
            Apply Settings
          </button>
        </div>
      </AdaptiveModal>

      {/* Searchable Home Currency Picker Bottom Sheet */}
      <CurrencyPickerSheet
        id="currency_picker_settings"
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        selectedCurrency={homeCurrency}
        homeCurrency={settings.homeCurrency}
        recentCurrencies={settings.recentCurrencies || []}
        onSelect={(code) => {
          setHomeCurrency(code);
          setShowCurrencyConfirm(false);
        }}
        title="Select Home Currency"
      />
    </>
  );
};
