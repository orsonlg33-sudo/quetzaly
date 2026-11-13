/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Check } from 'lucide-react';
import {
  getCurrencyName,
  getCurrencySymbol,
  getCachedCurrencies,
  loadAndCacheSupportedCurrencies,
} from '../lib/currency';
import { AdaptiveModal } from './AdaptiveModal';
import { useModalStack } from '../lib/modalStack';

interface CurrencyPickerSheetProps {
  id?: string;
  isOpen: boolean;
  onClose: () => void;
  selectedCurrency: string;
  homeCurrency: string;
  recentCurrencies?: string[];
  onSelect: (currencyCode: string) => void;
  title?: string;
}

export const CurrencyPickerSheet: React.FC<CurrencyPickerSheetProps> = ({
  id = 'currency_picker_sheet',
  isOpen,
  onClose,
  selectedCurrency,
  homeCurrency,
  recentCurrencies = [],
  onSelect,
  title = 'Currency',
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currencies, setCurrencies] = useState<string[]>(() => getCachedCurrencies());
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { zIndex } = useModalStack(id, isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);

      loadAndCacheSupportedCurrencies().then((list) => {
        if (list && list.length > 0) {
          setCurrencies(list);
        }
      });
    }
  }, [isOpen]);

  // Clean recent currencies (deduplicated, excluding home currency, max 4)
  const cleanedRecents = useMemo(() => {
    const list: string[] = [];
    for (const code of recentCurrencies) {
      const upper = code.toUpperCase();
      if (upper !== homeCurrency.toUpperCase() && !list.includes(upper)) {
        list.push(upper);
        if (list.length >= 4) break;
      }
    }
    return list;
  }, [recentCurrencies, homeCurrency]);

  const currencyItems = useMemo(() => {
    return currencies.map((code) => {
      const name = getCurrencyName(code);
      const symbol = getCurrencySymbol(code);
      return {
        code,
        name,
        symbol: symbol === code ? code : symbol,
        searchStr: `${code} ${name} ${symbol}`.toLowerCase(),
      };
    });
  }, [currencies]);

  const filteredCurrencies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return currencyItems;
    return currencyItems.filter((item) => item.searchStr.includes(q));
  }, [currencyItems, searchQuery]);

  if (!isOpen) return null;

  const handleSelect = (code: string) => {
    onSelect(code);
    onClose();
  };

  const isSearching = searchQuery.trim().length > 0;

  const renderCurrencyRow = (code: string, isSelected: boolean, keyPrefix = '') => {
    const upperCode = code.toUpperCase();
    const name = getCurrencyName(upperCode);
    const rawSymbol = getCurrencySymbol(upperCode);
    const isDistinct = Boolean(rawSymbol && rawSymbol.trim().toUpperCase() !== upperCode);
    const squareText = isDistinct ? rawSymbol : upperCode;
    const sublineText = isDistinct ? upperCode : '';

    return (
      <button
        key={`${keyPrefix}_${upperCode}`}
        type="button"
        onClick={() => handleSelect(upperCode)}
        className="w-full flex items-center justify-between py-3 text-left hover:bg-[var(--bg-elevated)]/40 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Neutral square box showing symbol if distinct, else code */}
          <span className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] text-[var(--text-primary)] flex items-center justify-center font-bold text-xs shrink-0">
            {squareText}
          </span>
          <div className="truncate">
            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
              {name}
            </p>
            {sublineText ? (
              <p className="text-[11px] text-[var(--text-secondary)]">
                {sublineText}
              </p>
            ) : null}
          </div>
        </div>

        {isSelected && (
          <Check className="w-4 h-4 text-[var(--accent)] shrink-0" />
        )}
      </button>
    );
  };

  return (
    <AdaptiveModal
      id={id}
      isOpen={isOpen}
      onClose={onClose}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] shrink-0">
        <h3 className="text-base font-bold text-[var(--text-primary)]">
          {title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          Done
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-6 pt-3 pb-2 shrink-0">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search, e.g. quetzal or GTQ"
            className="w-full pl-10 pr-9 py-2.5 text-xs rounded-2xl bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Currency List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-2 space-y-4">
        {/* Top Sections when not searching */}
        {!isSearching && (
          <>
            {/* Home Currency Item */}
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)] px-1 block mb-1">
                Home
              </span>
              <div className="divide-y divide-[var(--border-subtle)]">
                {renderCurrencyRow(
                  homeCurrency,
                  selectedCurrency.toUpperCase() === homeCurrency.toUpperCase(),
                  'home'
                )}
              </div>
            </div>

            {/* Recent Currencies */}
            {cleanedRecents.length > 0 && (
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)] px-1 block mb-1">
                  Recent
                </span>
                <div className="divide-y divide-[var(--border-subtle)]">
                  {cleanedRecents.map((code) =>
                    renderCurrencyRow(
                      code,
                      selectedCurrency.toUpperCase() === code.toUpperCase(),
                      'recent'
                    )
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* All Currencies Section */}
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)] px-1 block mb-1">
            {isSearching ? `Matching Currencies (${filteredCurrencies.length})` : 'All Currencies'}
          </span>

          {filteredCurrencies.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
              No currencies matching &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {filteredCurrencies.map((item) =>
                renderCurrencyRow(
                  item.code,
                  selectedCurrency.toUpperCase() === item.code,
                  'all'
                )
              )}
            </div>
          )}
        </div>
      </div>
    </AdaptiveModal>
  );
};
