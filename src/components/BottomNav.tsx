/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Home, ListFilter, TrendingUp, Settings, Plus } from 'lucide-react';

interface BottomNavProps {
  activeTab: 'home' | 'transactions' | 'insights' | 'settings';
  onSelectTab: (tab: 'home' | 'transactions' | 'insights' | 'settings') => void;
  onOpenAddModal: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenAddModal,
}) => {
  return (
    <nav aria-label="Main Navigation" className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] pb-safe shadow-2xl">
      <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between relative">
        {/* Home Tab */}
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded-lg ${
            activeTab === 'home' ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          aria-label="Home"
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span className="text-[11px]">Home</span>
        </button>

        {/* Transactions Tab */}
        <button
          type="button"
          onClick={() => onSelectTab('transactions')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded-lg ${
            activeTab === 'transactions' ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          aria-label="Transactions"
        >
          <ListFilter className="w-5 h-5 mb-0.5" />
          <span className="text-[11px]">History</span>
        </button>

        {/* Central Floating Add Button (Amber Accent with dark plus icon) */}
        <div className="flex-1 flex justify-center -mt-6">
          <button
            type="button"
            onClick={onOpenAddModal}
            className="w-13 h-13 rounded-full bg-[var(--accent)] text-[#0F100E] hover:scale-105 active:scale-95 flex items-center justify-center shadow-xl transition-all outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] cursor-pointer"
            aria-label="Add Transaction"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* Insights Tab */}
        <button
          type="button"
          onClick={() => onSelectTab('insights')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded-lg ${
            activeTab === 'insights' ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          aria-label="Insights"
        >
          <TrendingUp className="w-5 h-5 mb-0.5" />
          <span className="text-[11px]">Insights</span>
        </button>

        {/* Settings Tab */}
        <button
          type="button"
          onClick={() => onSelectTab('settings')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded-lg ${
            activeTab === 'settings' ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          aria-label="Settings"
        >
          <Settings className="w-5 h-5 mb-0.5" />
          <span className="text-[11px]">Settings</span>
        </button>
      </div>
    </nav>
  );
};
