/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useModalStack } from '../lib/modalStack';

export interface AdaptiveModalProps {
  id: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Max width class, defaults to max-w-[560px] */
  maxWidthClass?: string;
  /** Additional classes on the card container */
  className?: string;
  /** Whether to show the top drag handle on mobile (default true) */
  showDragHandle?: boolean;
  /** Optional inline styles for card */
  cardStyle?: React.CSSProperties;
  /** Optional touch event handlers for pull-to-dismiss */
  onTouchStart?: React.TouchEventHandler<HTMLDivElement>;
  onTouchMove?: React.TouchEventHandler<HTMLDivElement>;
  onTouchEnd?: React.TouchEventHandler<HTMLDivElement>;
}

export const AdaptiveModal: React.FC<AdaptiveModalProps> = ({
  id,
  isOpen,
  onClose,
  children,
  maxWidthClass = 'max-w-[560px]',
  className = '',
  showDragHandle = true,
  cardStyle,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}) => {
  const { zIndex } = useModalStack(id, isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      style={{ zIndex }}
      onClick={onClose}
    >
      <div
        style={cardStyle}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className={`bg-[var(--bg-surface)] text-[var(--text-primary)] w-full ${maxWidthClass} rounded-t-[28px] rounded-b-none sm:rounded-[28px] max-h-[90dvh] sm:max-h-[85dvh] flex flex-col shadow-2xl border border-[var(--border-subtle)] overflow-hidden ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Centred 36 × 4px drag handle for mobile bottom sheet (neutral grey, hidden on >= 640px) */}
        {showDragHandle && (
          <div
            className="w-9 h-1 bg-[var(--text-secondary)]/30 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0"
            aria-hidden="true"
          />
        )}
        {children}
      </div>
    </div>
  );
};

/**
 * Standard pinned actions container at bottom of modal/sheet.
 * Enforces safe-area inset + 16px bottom padding on mobile under 640px,
 * and 24px padding on desktop.
 */
export const AdaptiveModalActions: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div
      className={`p-6 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-6 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0 space-y-3 ${className}`}
    >
      {children}
    </div>
  );
};
