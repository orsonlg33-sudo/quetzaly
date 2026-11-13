/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { AdaptiveModal, AdaptiveModalActions } from './AdaptiveModal';
import { Globe, Calendar, ShieldCheck, ChevronRight } from 'lucide-react';
import { getCurrencyName } from '../lib/currency';
import { CurrencyPickerSheet } from './CurrencyPickerSheet';
import { UserSettings } from '../types/finance';
import {
  getWelcomeInitialValues,
  buildWelcomeGetStartedUpdates,
} from '../lib/welcomeLogic';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGetStarted: (settingsUpdates: Partial<UserSettings>) => void;
  currentSettings: UserSettings;
  isSettingsLoaded?: boolean;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  onClose,
  onGetStarted,
  currentSettings,
  isSettingsLoaded = true,
}) => {
  const initialValues = getWelcomeInitialValues(currentSettings, isSettingsLoaded);

  const [homeCurrency, setHomeCurrency] = useState<string>(initialValues.homeCurrency);
  const [monthStartDay, setMonthStartDay] = useState<number>(initialValues.monthStartDay);
  const [hasEditedCurrency, setHasEditedCurrency] = useState<boolean>(false);
  const [hasEditedStartDay, setHasEditedStartDay] = useState<boolean>(false);
  const [isCurrencyPickerOpen, setIsCurrencyPickerOpen] = useState<boolean>(false);

  const prevOpenRef = useRef<boolean>(false);

  // Sync draft values whenever modal opens or settings finish loading before user edits
  useEffect(() => {
    const resolved = getWelcomeInitialValues(currentSettings, isSettingsLoaded);
    if (isOpen && !prevOpenRef.current) {
      setHomeCurrency(resolved.homeCurrency);
      setMonthStartDay(resolved.monthStartDay);
      setHasEditedCurrency(false);
      setHasEditedStartDay(false);
      setIsCurrencyPickerOpen(false);
    } else if (isOpen) {
      if (!hasEditedCurrency) {
        setHomeCurrency(resolved.homeCurrency);
      }
      if (!hasEditedStartDay) {
        setMonthStartDay(resolved.monthStartDay);
      }
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, currentSettings, isSettingsLoaded, hasEditedCurrency, hasEditedStartDay]);

  const getOrdinalSuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const handleGetStarted = () => {
    const updates = buildWelcomeGetStartedUpdates({
      initialCurrency: initialValues.homeCurrency,
      initialStartDay: initialValues.monthStartDay,
      selectedCurrency: homeCurrency,
      selectedStartDay: monthStartDay,
      hasEditedCurrency,
      hasEditedStartDay,
    });
    onGetStarted(updates);
  };

  return (
    <>
      <AdaptiveModal
        id="welcome_modal"
        isOpen={isOpen}
        onClose={handleSkip}
        maxWidthClass="max-w-[560px]"
      >
        <div className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0">
          {/* Title & Subtitle */}
          <div className="space-y-1.5 text-center sm:text-left">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Welcome to Quetzaly
            </h2>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              A private budgeting app for people who spend in more than one currency.
            </p>
          </div>

          {/* Three Short Points */}
          <div className="space-y-3.5 pt-1">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 text-[var(--accent)] mt-0.5">
                <Globe className="w-4 h-4" />
              </div>
              <p className="text-xs text-[var(--text-primary)] leading-relaxed pt-1">
                Track spending in any of 166 currencies, with the exchange rate saved on each entry
              </p>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 text-[var(--accent)] mt-0.5">
                <Calendar className="w-4 h-4" />
              </div>
              <p className="text-xs text-[var(--text-primary)] leading-relaxed pt-1">
                Set a budget cycle that starts on the day you choose, with limits and rollover
              </p>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 text-[var(--accent)] mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <p className="text-xs text-[var(--text-primary)] leading-relaxed pt-1">
                Everything stays on this device. Export a backup any time from Settings.
              </p>
            </div>
          </div>

          {/* Prompt for Initial Setup (Currency & Cycle Day) */}
          <div className="pt-4 border-t border-[var(--border-subtle)] space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Quick Setup
            </h3>

            {/* Your main currency */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-primary)] block">
                Your main currency
              </label>
              <button
                type="button"
                onClick={() => setIsCurrencyPickerOpen(true)}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-left cursor-pointer hover:bg-[var(--bg-elevated)]/80 transition-colors"
              >
                <span className="font-medium text-[var(--text-primary)]">
                  {getCurrencyName(homeCurrency)} ({homeCurrency})
                </span>
                <div className="flex items-center gap-1 text-[var(--text-secondary)]">
                  <span>Change</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            </div>

            {/* Day your budget cycle starts */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--text-primary)] block">
                Day your budget cycle starts
              </label>
              <div className="grid grid-cols-7 gap-1.5 select-none">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                  const isSelected = monthStartDay === day;
                  return (
                    <button
                      key={`welcome_day_${day}`}
                      type="button"
                      onClick={() => {
                        setMonthStartDay(day);
                        setHasEditedStartDay(day !== initialValues.monthStartDay);
                      }}
                      className={`h-8 rounded-xl text-xs font-semibold transition-all flex items-center justify-center cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--accent)] text-black font-bold shadow-sm'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/75'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Starts on the {monthStartDay}
                {getOrdinalSuffix(monthStartDay)}. Can be changed anytime in Settings.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <AdaptiveModalActions className="flex flex-col sm:flex-row items-center justify-between gap-3 space-y-0">
          <button
            type="button"
            onClick={handleSkip}
            className="w-full sm:w-auto text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] py-2 text-center cursor-pointer order-2 sm:order-1"
          >
            Skip
          </button>

          <button
            type="button"
            onClick={handleGetStarted}
            className="w-full sm:w-auto px-6 py-3.5 text-xs font-semibold rounded-2xl bg-[var(--accent)] text-black shadow-sm hover:opacity-90 transition-opacity cursor-pointer text-center order-1 sm:order-2"
          >
            Get started
          </button>
        </AdaptiveModalActions>
      </AdaptiveModal>

      {/* Currency Picker */}
      <CurrencyPickerSheet
        id="welcome_currency_picker"
        isOpen={isCurrencyPickerOpen}
        onClose={() => setIsCurrencyPickerOpen(false)}
        selectedCurrency={homeCurrency}
        homeCurrency={homeCurrency}
        recentCurrencies={[]}
        onSelect={(code) => {
          setHomeCurrency(code);
          setHasEditedCurrency(code !== initialValues.homeCurrency);
          setIsCurrencyPickerOpen(false);
        }}
        title="Your main currency"
      />
    </>
  );
};
