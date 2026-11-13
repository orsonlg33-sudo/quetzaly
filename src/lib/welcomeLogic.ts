/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserSettings } from '../types/finance';

export const WELCOME_DEFAULT_CURRENCY = 'USD';
export const WELCOME_DEFAULT_MONTH_START_DAY = 1;

export interface WelcomeInitialValues {
  homeCurrency: string;
  monthStartDay: number;
}

/**
 * Resolves the prefilled currency and cycle start day for the Welcome sheet.
 * Uses saved settings if loaded, falling back to USD and day 1 only for an empty first launch.
 */
export function getWelcomeInitialValues(
  currentSettings: Partial<UserSettings> | null | undefined,
  isSettingsLoaded: boolean
): WelcomeInitialValues {
  if (!isSettingsLoaded || !currentSettings) {
    return {
      homeCurrency: WELCOME_DEFAULT_CURRENCY,
      monthStartDay: WELCOME_DEFAULT_MONTH_START_DAY,
    };
  }

  return {
    homeCurrency: currentSettings.homeCurrency || WELCOME_DEFAULT_CURRENCY,
    monthStartDay: currentSettings.monthStartDay || WELCOME_DEFAULT_MONTH_START_DAY,
  };
}

/**
 * "Skip" never writes currency, cycle day, or any other setting — only marks welcome as seen.
 */
export function buildWelcomeSkipUpdates(): Partial<UserSettings> {
  return {
    hasSeenWelcome: true,
  };
}

/**
 * "Get started" writes main currency and/or cycle day ONLY if the user actually changed them
 * from the initial values shown when the sheet opened.
 */
export function buildWelcomeGetStartedUpdates(params: {
  initialCurrency: string;
  initialStartDay: number;
  selectedCurrency: string;
  selectedStartDay: number;
  hasEditedCurrency: boolean;
  hasEditedStartDay: boolean;
}): Partial<UserSettings> {
  const updates: Partial<UserSettings> = {
    hasSeenWelcome: true,
  };

  if (
    params.hasEditedCurrency &&
    params.selectedCurrency &&
    params.selectedCurrency !== params.initialCurrency
  ) {
    updates.homeCurrency = params.selectedCurrency;
  }

  if (
    params.hasEditedStartDay &&
    params.selectedStartDay !== params.initialStartDay
  ) {
    updates.monthStartDay = params.selectedStartDay;
  }

  return updates;
}

/**
 * Applies Skip dismissal safely. Never writes to storage if settings were not loaded.
 */
export async function applyWelcomeSkip(params: {
  isSettingsLoaded: boolean;
  saveSettings: (updates: Partial<UserSettings>) => Promise<UserSettings>;
}): Promise<UserSettings | null> {
  if (!params.isSettingsLoaded) {
    return null;
  }
  return params.saveSettings(buildWelcomeSkipUpdates());
}

/**
 * Applies Get started dismissal safely. Never writes to storage if settings were not loaded,
 * and never writes currency or cycle day unless actually changed relative to currentSettings.
 */
export async function applyWelcomeGetStarted(params: {
  isSettingsLoaded: boolean;
  currentSettings: UserSettings;
  updates?: Partial<UserSettings>;
  saveSettings: (updates: Partial<UserSettings>) => Promise<UserSettings>;
}): Promise<{
  saved: UserSettings | null;
  currencyChanged: boolean;
  dayChanged: boolean;
}> {
  if (!params.isSettingsLoaded) {
    return { saved: null, currencyChanged: false, dayChanged: false };
  }

  const nextUpdates: Partial<UserSettings> = {
    hasSeenWelcome: true,
  };

  const currencyChanged = Boolean(
    params.updates?.homeCurrency &&
      params.updates.homeCurrency.toUpperCase() !==
        (params.currentSettings.homeCurrency || WELCOME_DEFAULT_CURRENCY).toUpperCase()
  );

  const dayChanged = Boolean(
    params.updates?.monthStartDay !== undefined &&
      params.updates.monthStartDay !==
        (params.currentSettings.monthStartDay || WELCOME_DEFAULT_MONTH_START_DAY)
  );

  if (currencyChanged && params.updates?.homeCurrency) {
    nextUpdates.homeCurrency = params.updates.homeCurrency;
  }

  if (dayChanged && params.updates?.monthStartDay !== undefined) {
    nextUpdates.monthStartDay = params.updates.monthStartDay;
  }

  const saved = await params.saveSettings(nextUpdates);
  return { saved, currencyChanged, dayChanged };
}
