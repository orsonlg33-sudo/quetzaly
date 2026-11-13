/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserSettings } from '../types/finance';

export type ResolvedTheme = 'light' | 'dark';

/**
 * Resolves the active theme ('light' | 'dark') from a stored preference and device setting.
 * - If no preference is saved (undefined/null), defaults to 'dark' regardless of device setting.
 * - A saved preference ('light', 'dark', or 'system' / follow-device) always wins over the default.
 */
export function resolveTheme(
  savedThemeMode: UserSettings['themeMode'] | null | undefined,
  systemPrefersDark: boolean
): ResolvedTheme {
  if (savedThemeMode === 'light') {
    return 'light';
  }
  if (savedThemeMode === 'dark') {
    return 'dark';
  }
  if (savedThemeMode === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }
  return 'dark';
}

export function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyThemeToDom(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}
