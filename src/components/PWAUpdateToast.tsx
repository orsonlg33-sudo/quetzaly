/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { RefreshCw, X } from 'lucide-react';

interface PWAUpdateToastProps {
  show: boolean;
  onReload: () => void;
  onDismiss: () => void;
}

export const PWAUpdateToast: React.FC<PWAUpdateToastProps> = ({
  show,
  onReload,
  onDismiss,
}) => {
  if (!show) return null;

  return (
    <div
      className="fixed z-50 w-full max-w-md px-4 left-1/2 -translate-x-1/2 pointer-events-auto transition-all"
      style={{
        bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="bg-[#2C2523] dark:bg-[#1F1A18] text-[#FBF9F5] rounded-2xl shadow-xl border border-white/10 p-3.5 flex items-center justify-between gap-3 transition-all animate-in fade-in slide-in-from-bottom-3 duration-200">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center shrink-0">
            <RefreshCw className="w-4 h-4" />
          </span>
          <p className="text-xs font-semibold text-white truncate">
            A new version is ready
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onReload}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[var(--accent)] text-black hover:opacity-90 shadow-sm transition-colors cursor-pointer"
          >
            Reload
          </button>

          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded-lg text-[#B5ADA9] hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
