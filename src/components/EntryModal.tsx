/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Camera,
  Delete,
  Check,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { Category, FinanceEntry, TransactionType, UserSettings, RateStatus } from '../types/finance';
import { decimalStringToCents, centsToDecimalString, formatCents, getCurrencyConfig, formatTransactionDate } from '../lib/currency';
import { useModalStack } from '../lib/modalStack';
import { compressReceiptImage } from '../lib/imageCompressor';
import { formatDateKey } from '../lib/periodMath';
import { getExchangeRate, calculateHomeAmountCents } from '../lib/exchangeRate';
import { CurrencyPickerSheet } from './CurrencyPickerSheet';
import { AdaptiveModal } from './AdaptiveModal';
import { CustomDatePickerModal } from './CustomDatePickerModal';

interface EntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Partial<FinanceEntry>) => void;
  categories: Category[];
  settings: UserSettings;
  editingEntry?: FinanceEntry | null;
  onOpenCategoryManager?: () => void;
}

export const EntryModal: React.FC<EntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  categories,
  settings,
  editingEntry,
  onOpenCategoryManager,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<TransactionType>('expense');
  const [amountStr, setAmountStr] = useState<string>('0');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>(formatDateKey(new Date()));
  const [currency, setCurrency] = useState<string>(settings.lastUsedCurrency || settings.homeCurrency);
  const [note, setNote] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState<boolean>(false);

  // Sub-modals & confirmation
  const [showDateSheet, setShowDateSheet] = useState<boolean>(false);
  const [showNoteSheet, setShowNoteSheet] = useState<boolean>(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState<boolean>(false);

  // Rate state
  const [rate, setRate] = useState<number>(1.0);
  const [rateStatus, setRateStatus] = useState<RateStatus>('fetched');
  const [isManualRate, setIsManualRate] = useState<boolean>(false);
  const [manualRateInput, setManualRateInput] = useState<string>('1.0');
  const [isLoadingRate, setIsLoadingRate] = useState<boolean>(false);
  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(false);
  const [showEditRateSheet, setShowEditRateSheet] = useState<boolean>(false);

  // Long press for backspace to clear amount
  const backspaceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef<boolean>(false);

  // Drag down to close gesture
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragCurrentY, setDragCurrentY] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset when modal opens or editingEntry changes
  useEffect(() => {
    if (isOpen) {
      setShowDiscardConfirm(false);
      setDragCurrentY(0);
      setDragStartY(null);

      if (editingEntry) {
        setType(editingEntry.type);
        setAmountStr(centsToDecimalString(editingEntry.amount));
        setSelectedCategoryId(editingEntry.categoryId);
        setDateStr(editingEntry.date);
        setCurrency(editingEntry.currency);
        setNote(editingEntry.note || '');
        setPhotoUrl(editingEntry.photoUrl);

        const isManual = Boolean(editingEntry.rateEditedManually || editingEntry.rateStatus === 'manual');
        setIsManualRate(isManual);
        setRate(editingEntry.rate || 1.0);
        setManualRateInput(String(editingEntry.rate || 1.0));
        setRateStatus(editingEntry.rateStatus || 'fetched');
        setStep(1);
      } else {
        setType('expense');
        setAmountStr('0');
        setDateStr(formatDateKey(new Date()));
        setCurrency(settings.lastUsedCurrency || settings.homeCurrency);
        setNote('');
        setPhotoUrl(undefined);
        setIsManualRate(false);
        setRate(1.0);
        setManualRateInput('1.0');
        setRateStatus('fetched');
        setSelectedCategoryId('');
        setStep(1);
      }
    }
  }, [isOpen, editingEntry, settings]);

  // Fetch exchange rate preview
  useEffect(() => {
    if (!isOpen) return;

    if (currency.toUpperCase() === settings.homeCurrency.toUpperCase()) {
      setRate(1.0);
      setRateStatus('fetched');
      setIsManualRate(false);
      return;
    }

    if (isManualRate) return;

    let isCancelled = false;
    async function fetchRate() {
      setIsLoadingRate(true);
      try {
        const res = await getExchangeRate(currency, settings.homeCurrency, dateStr);
        if (!isCancelled) {
          setRate(res.rate);
          setRateStatus(res.rateStatus);
          setManualRateInput(res.rate > 0 ? String(res.rate) : '1.0');
        }
      } catch {
        if (!isCancelled) {
          setRate(0);
          setRateStatus('pending');
        }
      } finally {
        if (!isCancelled) setIsLoadingRate(false);
      }
    }

    fetchRate();
    return () => {
      isCancelled = true;
    };
  }, [currency, dateStr, settings.homeCurrency, isManualRate, isOpen]);

  const requestClose = useCallback(() => {
    const hasTypedAmount = amountStr !== '0' && amountStr !== '' && amountStr !== '0.00';
    if (hasTypedAmount && !editingEntry) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [amountStr, editingEntry, onClose]);

  const { zIndex } = useModalStack('entry_modal', isOpen, requestClose);

  const handleDigit = useCallback((digit: string) => {
    setAmountStr((prev) => {
      if (prev === '0' && digit !== '.') {
        return digit;
      }
      if (prev.includes('.')) {
        const parts = prev.split('.');
        if (parts[1].length >= 2) return prev;
      }
      if (prev.length > 10) return prev;
      return prev + digit;
    });
  }, []);

  const handleDecimal = useCallback(() => {
    const decimals = getCurrencyConfig(currency).decimals;
    if (decimals === 0) return;
    setAmountStr((prev) => {
      if (!prev.includes('.')) {
        return prev + '.';
      }
      return prev;
    });
  }, [currency]);

  const handleBackspacePress = useCallback(() => {
    setAmountStr((prev) => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  }, []);

  // Desktop keyboard support on Step 1: digits 0-9, '.', Backspace, Enter, Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (showDiscardConfirm || showDateSheet || showNoteSheet || showEditRateSheet || isPickerOpen) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
        return;
      }

      if (step === 1) {
        if (e.key >= '0' && e.key <= '9') {
          e.preventDefault();
          handleDigit(e.key);
        } else if (e.key === '.' || e.key === ',') {
          e.preventDefault();
          handleDecimal();
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          handleBackspacePress();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const cents = decimalStringToCents(amountStr);
          if (cents > 0) {
            setStep(2);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    step,
    amountStr,
    showDiscardConfirm,
    showDateSheet,
    showNoteSheet,
    showEditRateSheet,
    isPickerOpen,
    requestClose,
    handleDigit,
    handleDecimal,
    handleBackspacePress,
  ]);

  if (!isOpen) return null;

  const currConfig = getCurrencyConfig(currency);
  const isForeign = currency.toUpperCase() !== settings.homeCurrency.toUpperCase();
  const visibleCategories = categories.filter(
    (c) => c.type === type && (!c.isArchived || c.id === selectedCategoryId)
  );

  const startBackspaceLongPress = () => {
    isLongPressRef.current = false;
    backspaceTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setAmountStr('0');
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(50);
        } catch {
          // Safe catch for vibrate API
        }
      }
    }, 500);
  };

  const endBackspaceLongPress = () => {
    if (backspaceTimerRef.current) {
      clearTimeout(backspaceTimerRef.current);
      backspaceTimerRef.current = null;
    }
    if (!isLongPressRef.current) {
      handleBackspacePress();
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressingPhoto(true);
      const compressed = await compressReceiptImage(file, 1000, 0.75);
      setPhotoUrl(compressed);
    } catch (err) {
      console.error('Failed to compress receipt photo:', err);
    } finally {
      setIsCompressingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Immediate save on category tile tap in Step 2
  const handleSelectCategoryAndSave = (catId: string) => {
    const cents = decimalStringToCents(amountStr);
    if (cents <= 0) return;

    let finalRate = rate;
    let finalStatus: RateStatus = rateStatus;
    let finalManual = isManualRate;

    if (!isForeign) {
      finalRate = 1.0;
      finalStatus = 'fetched';
      finalManual = false;
    } else if (isManualRate) {
      const parsedManual = parseFloat(manualRateInput);
      if (!isNaN(parsedManual) && parsedManual > 0) {
        finalRate = parsedManual;
        finalStatus = 'manual';
        finalManual = true;
      }
    }

    const homeAmount = isForeign
      ? calculateHomeAmountCents(cents, finalRate)
      : cents;

    const entryData: Partial<FinanceEntry> = {
      ...(editingEntry ? { id: editingEntry.id } : {}),
      type,
      amount: cents,
      currency,
      homeAmount,
      rate: finalRate,
      rateStatus: finalStatus,
      rateEditedManually: finalManual,
      date: dateStr,
      categoryId: catId,
      note: note.trim() || undefined,
      photoUrl,
    };

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(40);
      } catch {
        // Safe catch for vibrate API
      }
    }

    onSave(entryData);
    onClose();
  };

  const currentCents = decimalStringToCents(amountStr);
  const isValidAmount = currentCents > 0;

  // Format amount
  const integerPart = amountStr.split('.')[0] || '0';
  const decimalPart = amountStr.split('.')[1];
  const formattedInteger = Number(integerPart).toLocaleString('en-US');

  const activeRateValue = isManualRate ? (parseFloat(manualRateInput) || rate) : rate;
  const currentHomeAmount = isForeign ? calculateHomeAmountCents(currentCents, activeRateValue) : currentCents;
  const formattedHomeAmount = formatCents(currentHomeAmount, settings.homeCurrency);

  // Drag down handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartY !== null) {
      const delta = e.touches[0].clientY - dragStartY;
      if (delta > 0) {
        setDragCurrentY(delta);
      }
    }
  };

  const handleTouchEnd = () => {
    if (dragCurrentY > 120) {
      requestClose();
    }
    setDragCurrentY(0);
    setDragStartY(null);
  };

  return (
    <>
      <AdaptiveModal
        id="entry_modal"
        isOpen={isOpen}
        onClose={requestClose}
      showDragHandle={false}
      cardStyle={{
        transform: dragCurrentY > 0 ? `translateY(${dragCurrentY}px)` : 'none',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="justify-between touch-none"
    >
      {/* ================= STEP 1: AMOUNT ================= */}
        {step === 1 && (
          <div className="flex flex-col h-full min-h-0">
            {/* Header (shrink-0): Close ✕, Expense/Income switch, Currency */}
            <div className="w-full flex flex-col items-center pt-2.5 px-4 pb-2.5 border-b border-[var(--border-subtle)]/50 shrink-0 bg-[var(--bg-surface)]">
              <div className="w-9 h-1 rounded-full bg-[var(--text-secondary)]/30 mb-2 cursor-grab sm:hidden" />
              <div className="w-full flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={requestClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center bg-[var(--bg-elevated)] p-1 rounded-full">
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={`px-4 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                      type === 'expense'
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={`px-4 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                      type === 'income'
                        ? 'bg-[var(--bg-surface)] text-[var(--income)] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Income
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPickerOpen(true)}
                  className="px-3 py-1.5 text-xs font-bold rounded-full bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center gap-1 hover:bg-[var(--bg-elevated)]/80 shrink-0 cursor-pointer"
                >
                  <span>{currency}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                </button>
              </div>
            </div>

            {/* Body (flex-1 min-h-0 overflow-y-auto): Amount, conversion line, date pill, keypad */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 flex flex-col justify-center items-center space-y-2">
              {/* Centre: Amount large in the centre */}
              <div className="flex flex-col items-center justify-center py-1 text-center">
                <div className="flex items-baseline justify-center gap-1 tracking-tight select-all">
                  <span className="text-2xl sm:text-3xl font-medium text-[var(--text-secondary)]">
                    {currConfig.symbol}
                  </span>
                  <span
                    className="font-bold text-[var(--text-primary)] tabular-nums transition-all"
                    style={{
                      fontSize: formattedInteger.length > 8
                        ? 'clamp(30px, 5dvh, 44px)'
                        : formattedInteger.length > 6
                        ? 'clamp(34px, 6dvh, 52px)'
                        : 'clamp(38px, 7dvh, 60px)',
                      lineHeight: 1,
                    }}
                  >
                    {formattedInteger}
                  </span>
                  {currConfig.decimals > 0 && (
                    <span className="text-xl sm:text-2xl font-medium text-[var(--text-secondary)] tabular-nums">
                      .{decimalPart !== undefined ? decimalPart : '00'}
                    </span>
                  )}
                </div>

                {/* Conversion line under amount (if foreign) */}
                {isForeign && (
                  <button
                    type="button"
                    onClick={() => setShowEditRateSheet(true)}
                    className="mt-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>≈ {formattedHomeAmount}</span>
                    <span>·</span>
                    <span className="underline decoration-[var(--border-subtle)] underline-offset-2">
                      1 {currency} = {activeRateValue > 0 ? activeRateValue.toFixed(2) : '...'} {settings.homeCurrency}
                    </span>
                  </button>
                )}

                {/* Today ▾ date pill */}
                <button
                  type="button"
                  onClick={() => setShowDateSheet(true)}
                  className="mt-2 px-3.5 py-1 text-xs font-semibold rounded-full bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center gap-1 hover:bg-[var(--bg-elevated)]/80 transition-colors cursor-pointer"
                >
                  <span>{dateStr === formatDateKey(new Date()) ? 'Today' : formatTransactionDate(dateStr)}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                </button>
              </div>

              {/* Keypad: 3 columns (1-9, '.', 0, ⌫) */}
              <div className="w-full max-w-sm grid grid-cols-3 gap-1.5 select-none shrink-0 py-0.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleDigit(digit)}
                    className="h-[clamp(36px,5.2dvh,46px)] text-xl font-medium rounded-2xl bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/70 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                  >
                    {digit}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={handleDecimal}
                  className="h-[clamp(36px,5.2dvh,46px)] text-2xl font-bold rounded-2xl bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/70 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                >
                  .
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit('0')}
                  className="h-[clamp(36px,5.2dvh,46px)] text-xl font-medium rounded-2xl bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/70 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onPointerDown={startBackspaceLongPress}
                  onPointerUp={endBackspaceLongPress}
                  onPointerLeave={endBackspaceLongPress}
                  className="h-[clamp(36px,5.2dvh,46px)] text-base rounded-2xl bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                  title="Backspace (long-press to clear)"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Footer (shrink-0): Pinned Choose category → button */}
            <div className="p-4 sm:px-6 sm:py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0">
              <button
                type="button"
                disabled={!isValidAmount}
                onClick={() => setStep(2)}
                className={`w-full py-3.5 text-sm font-semibold rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 ${
                  isValidAmount
                    ? 'bg-[var(--accent)] text-black dark:text-black hover:opacity-90 active:scale-98 cursor-pointer'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] opacity-50 cursor-not-allowed'
                }`}
              >
                <span>Choose category →</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: CATEGORY GRID ================= */}
        {step === 2 && (
          <div className="flex flex-col h-full min-h-0 relative">
            {/* Header (shrink-0): "← Back" and Amount summary */}
            <div className="px-6 py-3.5 border-b border-[var(--border-subtle)] shrink-0 bg-[var(--bg-surface)] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <div className="text-right">
                <span className="text-sm font-bold tabular-nums text-[var(--text-primary)]">
                  {currConfig.symbol}{formattedInteger}.{decimalPart !== undefined ? decimalPart : '00'}
                </span>
                {isForeign && (
                  <span className="text-xs text-[var(--text-secondary)] block">
                    ≈ {formattedHomeAmount}
                  </span>
                )}
              </div>
            </div>

            {/* Body (flex-1 min-h-0 overflow-y-auto): Title, pills, and 3-column tile grid */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-3 relative">
              {/* Title */}
              <h3 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                What was it for?
              </h3>

              {/* Optional Pills: "Today ▾", "+ Note", "+ Receipt" */}
              <div className="flex items-center gap-2 py-1">
                <button
                  type="button"
                  onClick={() => setShowDateSheet(true)}
                  className="px-3 py-1.5 text-xs font-medium rounded-full bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center gap-1 hover:bg-[var(--bg-elevated)]/80 transition-colors cursor-pointer"
                >
                  <span>{dateStr === formatDateKey(new Date()) ? 'Today' : formatTransactionDate(dateStr)}</span>
                  <ChevronDown className="w-3 h-3 text-[var(--text-secondary)]" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowNoteSheet(true)}
                  className="px-3 py-1.5 text-xs font-medium rounded-full bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]/80 transition-colors cursor-pointer"
                >
                  {note ? `Note: ${note.slice(0, 10)}...` : '+ Note'}
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-medium rounded-full bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]/80 transition-colors cursor-pointer"
                >
                  {photoUrl ? 'Receipt attached' : '+ Receipt'}
                </button>
              </div>

              {/* 3-Column Grid of Large Category Tiles */}
              <div className="grid grid-cols-3 gap-3 pt-2 pb-6">
                {visibleCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCategoryAndSave(cat.id)}
                    className="p-3 rounded-2xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated)]/75 border border-[var(--border-subtle)] flex flex-col items-center justify-center text-center gap-1.5 transition-all active:scale-95 cursor-pointer h-[104px]"
                  >
                    <span className="text-2xl">{cat.emoji}</span>
                    <span className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight line-clamp-2 px-1">
                      {cat.name.replace(' & ', ' &\n')}
                    </span>
                  </button>
                ))}

                {/* "+ New" tile at the end */}
                {onOpenCategoryManager && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCategoryManager();
                    }}
                    className="p-3 rounded-2xl bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-dashed border-[var(--border-subtle)] flex flex-col items-center justify-center text-center gap-1.5 transition-all active:scale-95 cursor-pointer h-[104px]"
                  >
                    <Plus className="w-6 h-6 text-[var(--accent)]" />
                    <span className="text-[13px] font-semibold text-[var(--text-secondary)]">New</span>
                  </button>
                )}
              </div>
            </div>

            {/* Subtle bottom edge fade indicator */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[var(--bg-surface)] to-transparent shrink-0" aria-hidden="true" />
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={handlePhotoSelect}
          accept="image/*"
          className="hidden"
        />
      </AdaptiveModal>

      {/* Discard Confirmation Dialog */}
      {showDiscardConfirm && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          style={{ zIndex: zIndex + 20 }}
          onClick={() => setShowDiscardConfirm(false)}
        >
          <div
            className="bg-[var(--bg-surface)] w-full max-w-xs rounded-[28px] p-5 shadow-2xl border border-[var(--border-subtle)] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-bold text-[var(--text-primary)]">Discard this entry?</h4>
            <p className="text-xs text-[var(--text-secondary)]">
              You typed an amount that has not been logged yet.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="px-3.5 py-2 text-xs font-medium rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  onClose();
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--danger)] text-white hover:opacity-90"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Date Picker Modal */}
      <CustomDatePickerModal
        id="date_picker_entry"
        isOpen={showDateSheet}
        onClose={() => setShowDateSheet(false)}
        selectedDate={dateStr}
        onSelectDate={(d) => setDateStr(d)}
        title="Transaction date"
      />

      {/* Mini Sheet for Note */}
      {showNoteSheet && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          style={{ zIndex: zIndex + 10 }}
          onClick={() => setShowNoteSheet(false)}
        >
          <div
            className="bg-[var(--bg-surface)] w-full max-w-sm rounded-[28px] p-6 space-y-4 border border-[var(--border-subtle)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-bold text-[var(--text-primary)]">Add Note</h4>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Lunch with team"
              className="w-full px-4 py-3 text-xs rounded-2xl bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowNoteSheet(false)}
              className="w-full py-3 text-xs font-semibold rounded-2xl bg-[var(--accent)] text-black"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Mini Sheet for Rate Editing */}
      {showEditRateSheet && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          style={{ zIndex: zIndex + 10 }}
          onClick={() => setShowEditRateSheet(false)}
        >
          <div
            className="bg-[var(--bg-surface)] w-full max-w-sm rounded-[28px] p-6 space-y-4 border border-[var(--border-subtle)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-bold text-[var(--text-primary)]">Edit Conversion Rate</h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-secondary)]">1 {currency} =</span>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={manualRateInput}
                onChange={(e) => {
                  setManualRateInput(e.target.value);
                  setIsManualRate(true);
                }}
                className="flex-1 px-3 py-2 text-xs font-bold rounded-xl bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
              />
              <span className="text-xs text-[var(--text-secondary)]">{settings.homeCurrency}</span>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsManualRate(false);
                  setShowEditRateSheet(false);
                }}
                className="px-3 py-2 text-xs font-medium text-[var(--text-secondary)]"
              >
                Reset auto
              </button>
              <button
                type="button"
                onClick={() => setShowEditRateSheet(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--accent)] text-black"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Currency Picker Sheet */}
      <CurrencyPickerSheet
        id="currency_picker_entry"
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        selectedCurrency={currency}
        homeCurrency={settings.homeCurrency}
        recentCurrencies={settings.recentCurrencies || []}
        onSelect={(code) => setCurrency(code)}
        title="Currency"
      />
    </>
  );
};
