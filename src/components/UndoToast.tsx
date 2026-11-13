/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { RotateCcw, ImagePlus, X, Check } from 'lucide-react';
import { UndoAction } from '../types/finance';

interface UndoToastProps {
  action: UndoAction | null;
  onUndo: (action: UndoAction) => void;
  onDismiss: () => void;
  onAddReceiptShortcut?: (entryId: string) => void;
}

export const UndoToast: React.FC<UndoToastProps> = ({
  action,
  onUndo,
  onDismiss,
  onAddReceiptShortcut,
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!action) return;

    setProgress(100);
    const duration = 5000;
    const intervalTime = 50;
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [action, onDismiss]);

  if (!action) return null;

  return (
    <div
      className="fixed z-50 w-full max-w-md px-4 left-1/2 -translate-x-1/2 pointer-events-auto transition-all"
      style={{
        bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="bg-[#2C2523] dark:bg-[#1F1A18] text-[#FBF9F5] rounded-2xl shadow-xl border border-white/10 p-3.5 flex flex-col gap-3 transition-all animate-in fade-in slide-in-from-bottom-3 duration-200">
        {/* Line 1: Text & Close ✕ */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center shrink-0">
              <Check className="w-4 h-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-white">{action.title}</p>
              <p className="text-[11px] text-[#B5ADA9]">
                {action.type === 'add'
                  ? 'Saved to current cycle'
                  : action.type === 'edit'
                  ? 'Changes applied'
                  : 'Removed from cycle'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded-lg text-[#B5ADA9] hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Line 2: Buttons ("Undo" amber filled, "Add receipt" outline) */}
        <div className="flex items-center justify-end gap-2 pt-1">
          {action.type === 'add' && !action.entry.photoUrl && onAddReceiptShortcut && (
            <button
              type="button"
              onClick={() => {
                onAddReceiptShortcut(action.entry.id);
                onDismiss();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-white/20 hover:bg-white/10 text-[#FBF9F5] transition-colors cursor-pointer"
            >
              <ImagePlus className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Add receipt</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onUndo(action)}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl bg-[var(--accent)] text-black hover:opacity-90 shadow-sm transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
        </div>

        {/* Remaining countdown progress bar at bottom edge */}
        <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden -mb-1">
          <div
            className="bg-[var(--accent)] h-full transition-all duration-75 ease-linear rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
