/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useSyncExternalStore } from 'react';

// Central reactive active modal stack
let activeModalStack: string[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function pushModal(id: string) {
  if (!activeModalStack.includes(id)) {
    activeModalStack = [...activeModalStack, id];
    updateBodyScroll();
    notify();
  }
}

export function popModal(id: string) {
  if (activeModalStack.includes(id)) {
    activeModalStack = activeModalStack.filter((mId) => mId !== id);
    updateBodyScroll();
    notify();
  }
}

function updateBodyScroll() {
  if (typeof document !== 'undefined') {
    if (activeModalStack.length > 0) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return activeModalStack;
}

/**
 * Shared modal stacking hook.
 * Pushes modal onto global modal stack when open, calculates a dynamic z-index tier based on depth,
 * locks body scroll, and handles Escape key strictly for the top-most modal.
 */
export function useModalStack(id: string, isOpen: boolean, onClose?: () => void) {
  const stack = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (isOpen) {
      pushModal(id);
      return () => {
        popModal(id);
      };
    }
  }, [id, isOpen]);

  useEffect(() => {
    if (!isOpen || !onClose) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const isTop = stack[stack.length - 1] === id;
        if (isTop) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [id, isOpen, onClose, stack]);

  const stackIndex = stack.indexOf(id);
  // Base tier z-index 100, +50 for each stacked modal level
  const zIndex = stackIndex >= 0 ? 100 + stackIndex * 50 : 100;
  const isTop = stackIndex >= 0 && stackIndex === stack.length - 1;

  return {
    zIndex,
    isTop,
    stackDepth: stackIndex,
  };
}
