/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Trash2, Download, Upload } from 'lucide-react';
import { FinanceEntry, Category } from '../types/finance';
import { formatCents, formatTransactionDate } from '../lib/currency';
import { AdaptiveModal } from './AdaptiveModal';

interface ReceiptModalProps {
  entry: FinanceEntry | null;
  category?: Category;
  isOpen: boolean;
  onClose: () => void;
  onRemovePhoto?: (entryId: string) => void;
  onReplacePhoto?: (entryId: string, file: File) => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  entry,
  category,
  isOpen,
  onClose,
  onRemovePhoto,
  onReplacePhoto,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!isOpen || !entry || !entry.photoUrl) return null;

  const handleDownload = () => {
    if (!entry.photoUrl) return;
    const a = document.createElement('a');
    a.href = entry.photoUrl;
    a.download = `receipt-${entry.date}-${entry.id.slice(0, 8)}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onReplacePhoto) {
      onReplacePhoto(entry.id, file);
    }
  };

  return (
    <AdaptiveModal
      id="receipt_modal"
      isOpen={isOpen}
      onClose={onClose}
    >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2C2523]/8 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{category?.emoji || '🧾'}</span>
            <div>
              <h3 className="text-sm font-semibold text-[#2C2523] dark:text-[#F7F4F0]">
                {category?.name || 'Receipt Photo'}
              </h3>
              <p className="text-xs text-[#706764] dark:text-[#B5ADA9]">
                {formatTransactionDate(entry.date)} · {formatCents(entry.amount, entry.currency)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[#706764] hover:text-[#2C2523] dark:text-[#B5ADA9] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image Display */}
        <div className="flex-1 overflow-auto bg-[#FBF9F5] dark:bg-[#191514] p-4 flex items-center justify-center min-h-[260px]">
          <img
            src={entry.photoUrl}
            alt="Attached receipt"
            className="max-h-[60vh] max-w-full rounded-2xl object-contain shadow-sm border border-black/5"
          />
        </div>

        {/* Note if available */}
        {entry.note && (
          <div className="px-5 py-2.5 bg-[#F5EFE9] dark:bg-[#2C2624] text-xs text-[#706764] dark:text-[#B5ADA9] italic border-t border-[#2C2523]/5 dark:border-white/5">
            &ldquo;{entry.note}&rdquo;
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-white dark:bg-[#231E1C] border-t border-[#2C2523]/8 dark:border-white/10 gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          <div className="flex items-center gap-2">
            {onReplacePhoto && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-[#2C2523]/15 dark:border-white/15 text-[#2C2523] dark:text-[#F7F4F0] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-[#C85A32]" />
                <span>Replace</span>
              </button>
            )}

            {onRemovePhoto && (
              <button
                type="button"
                onClick={() => {
                  onRemovePhoto(entry.id);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-[#2C2523] dark:bg-white text-white dark:text-[#2C2523] hover:opacity-90 transition-opacity"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </AdaptiveModal>
  );
};
