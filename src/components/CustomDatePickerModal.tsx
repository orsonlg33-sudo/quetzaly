/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { AdaptiveModal } from './AdaptiveModal';
import { getTodayDateString, parseDate, formatDate, getDaysInMonth } from '../lib/recurringMath';
import { APP_LOCALE } from '../lib/currency';

export interface CustomDatePickerModalProps {
  id?: string;
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  minDate?: string; // YYYY-MM-DD (optional minimum allowed date)
  showNoEndDate?: boolean; // For recurring end date selector
  onSelectNoEndDate?: () => void;
  title?: string;
}

export function formatFullDate(dateStr: string): string {
  if (!dateStr) return '';
  const { year, month, day } = parseDate(dateStr);
  const dateObj = new Date(year, month - 1, day);
  const weekday = dateObj.toLocaleDateString(APP_LOCALE, { weekday: 'short' });
  const monthName = dateObj.toLocaleDateString(APP_LOCALE, { month: 'short' });
  return `${weekday}, ${day} ${monthName} ${year}`;
}

export const CustomDatePickerModal: React.FC<CustomDatePickerModalProps> = ({
  id = 'custom_date_picker',
  isOpen,
  onClose,
  selectedDate,
  onSelectDate,
  minDate,
  showNoEndDate = false,
  onSelectNoEndDate,
  title = 'Select date',
}) => {
  const todayStr = getTodayDateString();
  const initialParse = parseDate(selectedDate || todayStr);

  const [viewYear, setViewYear] = useState<number>(initialParse.year);
  const [viewMonth, setViewMonth] = useState<number>(initialParse.month); // 1-indexed

  useEffect(() => {
    if (isOpen) {
      const parsed = parseDate(selectedDate || todayStr);
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  }, [isOpen, selectedDate, todayStr]);

  if (!isOpen) return null;

  // Month navigation
  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Month title: "November 2026"
  const monthDateObj = new Date(viewYear, viewMonth - 1, 1);
  const monthTitle = monthDateObj.toLocaleDateString(APP_LOCALE, {
    month: 'long',
    year: 'numeric',
  });

  // Calendar Grid computation
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDayOfWeek = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0 = Sunday

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const handleDayClick = (dayNum: number) => {
    const dateKey = formatDate(viewYear, viewMonth, dayNum);
    if (minDate && dateKey < minDate) return;
    onSelectDate(dateKey);
    onClose();
  };

  const handleTodayClick = () => {
    if (minDate && todayStr < minDate) {
      onSelectDate(minDate);
    } else {
      onSelectDate(todayStr);
    }
    onClose();
  };

  const formattedSelected = selectedDate ? formatFullDate(selectedDate) : 'No date set';

  return (
    <AdaptiveModal id={id} isOpen={isOpen} onClose={onClose} maxWidthClass="max-w-[380px]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-[var(--border-subtle)] shrink-0">
        <h4 className="text-sm font-bold text-[var(--text-primary)]">{title}</h4>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Calendar Header: Month + Year title & Nav Arrows */}
      <div className="p-4 pb-2 space-y-3 flex-1 min-h-0 overflow-y-auto">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-[var(--text-primary)] capitalize">
            {monthTitle}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Weekday Row (Su Mo Tu We Th Fr Sa) */}
        <div className="grid grid-cols-7 gap-1 text-center select-none">
          {weekDays.map((wd) => (
            <span
              key={wd}
              className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] py-1"
            >
              {wd}
            </span>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 select-none pt-1">
          {/* Leading empty cells for offset */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty_${i}`} className="h-9" />
          ))}

          {/* Days of month */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dateKey = formatDate(viewYear, viewMonth, day);
            const isSelected = dateKey === selectedDate;
            const isToday = dateKey === todayStr;
            const isDisabled = Boolean(minDate && dateKey < minDate);

            return (
              <button
                key={`day_${day}`}
                type="button"
                disabled={isDisabled}
                onClick={() => handleDayClick(day)}
                className={`h-9 rounded-xl text-xs font-semibold transition-all flex items-center justify-center cursor-pointer ${
                  isDisabled
                    ? 'opacity-25 pointer-events-none text-[var(--text-secondary)]'
                    : isSelected
                    ? 'bg-[var(--accent)] text-black dark:text-black font-bold shadow-sm'
                    : isToday
                    ? 'border-2 border-[var(--accent)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                    : 'bg-[var(--bg-elevated)]/60 text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Footer Bar: Today / No end date on left, Selected date on right */}
      <div className="p-4 pt-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTodayClick}
            className="font-semibold text-[var(--accent)] hover:underline cursor-pointer"
          >
            Today
          </button>
          {showNoEndDate && onSelectNoEndDate && (
            <button
              type="button"
              onClick={() => {
                onSelectNoEndDate();
                onClose();
              }}
              className="font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              No end date
            </button>
          )}
        </div>

        <span className="font-medium text-[var(--text-secondary)] tabular-nums">
          {formattedSelected}
        </span>
      </div>
    </AdaptiveModal>
  );
};
