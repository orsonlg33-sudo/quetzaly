/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  Search,
} from 'lucide-react';
import { Category, TransactionType } from '../types/finance';
import { AdaptiveModal } from './AdaptiveModal';
import { useModalStack } from '../lib/modalStack';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSaveCategory: (category: Category) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<{ archived: boolean; entryCount: number }>;
  onUnarchiveCategory: (categoryId: string) => Promise<void>;
  initialType?: TransactionType;
}

// 8 Warm Chart Colours ONLY
export const WARM_CHART_COLORS = [
  '#FFB020',
  '#E8761A',
  '#4FD1A1',
  '#C9A86A',
  '#8FA67A',
  '#D9826B',
  '#A8A29E',
  '#7FA8A0',
];

// About 120 emoji in labelled groups with keywords for search
export const EMOJI_GROUPS: Array<{
  name: string;
  items: Array<{ emoji: string; keywords: string }>;
}> = [
  {
    name: 'Food',
    items: [
      { emoji: '🍕', keywords: 'pizza food fast food' },
      { emoji: '🍔', keywords: 'burger fast food dinner' },
      { emoji: '🍟', keywords: 'fries snack potato' },
      { emoji: '🌮', keywords: 'taco mexican food' },
      { emoji: '🌯', keywords: 'burrito wrap' },
      { emoji: '🥗', keywords: 'salad healthy green' },
      { emoji: '🍜', keywords: 'ramen noodle soup' },
      { emoji: '🍣', keywords: 'sushi japanese fish' },
      { emoji: '🥪', keywords: 'sandwich lunch deli' },
      { emoji: '🥖', keywords: 'bread bakery baguette' },
      { emoji: '🥐', keywords: 'croissant breakfast pastry' },
      { emoji: '🍳', keywords: 'egg breakfast cook' },
      { emoji: '🥩', keywords: 'meat steak butcher' },
      { emoji: '🍗', keywords: 'chicken poultry' },
      { emoji: '☕', keywords: 'coffee cafe espresso latte' },
      { emoji: '🍵', keywords: 'tea matcha green' },
      { emoji: '🍺', keywords: 'beer pub bar drink' },
      { emoji: '🍷', keywords: 'wine bar dinner drink' },
      { emoji: '🍸', keywords: 'cocktail bar drink' },
      { emoji: '🍦', keywords: 'ice cream dessert sweet' },
      { emoji: '🍰', keywords: 'cake dessert bakery' },
      { emoji: '🍫', keywords: 'chocolate candy sweet' },
      { emoji: '🍎', keywords: 'apple fruit grocery' },
      { emoji: '🥑', keywords: 'avocado grocery fresh' },
      { emoji: '🛒', keywords: 'supermarket grocery market' },
    ],
  },
  {
    name: 'Travel and home',
    items: [
      { emoji: '🚗', keywords: 'car commute drive fuel auto' },
      { emoji: '🚕', keywords: 'taxi uber cab ride' },
      { emoji: '🚌', keywords: 'bus transit public' },
      { emoji: '🚇', keywords: 'metro subway train transit' },
      { emoji: '🚆', keywords: 'train railway commute' },
      { emoji: '✈️', keywords: 'flight plane airline travel trip' },
      { emoji: '⛽', keywords: 'gas petrol fuel station' },
      { emoji: '🚲', keywords: 'bike bicycle cycle' },
      { emoji: '🛴', keywords: 'scooter e-scooter' },
      { emoji: '🏠', keywords: 'home house rent mortgage' },
      { emoji: '🏢', keywords: 'office building work apartment' },
      { emoji: '🛋️', keywords: 'furniture couch living room' },
      { emoji: '💡', keywords: 'light electricity utility power' },
      { emoji: '🔌', keywords: 'electronics plug power utility' },
      { emoji: '🚰', keywords: 'water utility tap' },
      { emoji: '🧹', keywords: 'cleaning housekeeping broom' },
      { emoji: '🛠️', keywords: 'tools maintenance repair diy' },
      { emoji: '📦', keywords: 'package delivery parcel mail' },
      { emoji: '🧳', keywords: 'luggage travel vacation hotel' },
      { emoji: '🏨', keywords: 'hotel resort stay lodging' },
    ],
  },
  {
    name: 'Life',
    items: [
      { emoji: '💊', keywords: 'pharmacy medicine prescription drug' },
      { emoji: '🩺', keywords: 'doctor clinic medical health' },
      { emoji: '🏥', keywords: 'hospital emergency health' },
      { emoji: '🦷', keywords: 'dentist teeth dental' },
      { emoji: '🏋️', keywords: 'gym workout fitness exercise' },
      { emoji: '🧘', keywords: 'yoga meditation wellness' },
      { emoji: '💈', keywords: 'barber haircut hair grooming' },
      { emoji: '💇', keywords: 'hair salon styling beauty' },
      { emoji: '🧴', keywords: 'lotion skincare cosmetics' },
      { emoji: '🧼', keywords: 'soap bath hygiene' },
      { emoji: '🐶', keywords: 'dog pet vet puppy' },
      { emoji: '🐱', keywords: 'cat pet vet kitten' },
      { emoji: '🐾', keywords: 'pet paws vet animal' },
      { emoji: '👶', keywords: 'baby child daycare kid' },
      { emoji: '🎓', keywords: 'education university school tuition' },
      { emoji: '📚', keywords: 'books study education read' },
      { emoji: '👓', keywords: 'glasses optical vision' },
      { emoji: '🌿', keywords: 'nature plant garden flower' },
    ],
  },
  {
    name: 'Money and work',
    items: [
      { emoji: '💼', keywords: 'salary job work business career' },
      { emoji: '💰', keywords: 'money cash income wealth' },
      { emoji: '💵', keywords: 'cash dollar note bill' },
      { emoji: '🪙', keywords: 'coin cash change tip' },
      { emoji: '💳', keywords: 'card credit debit payment' },
      { emoji: '🏦', keywords: 'bank savings transfer atm' },
      { emoji: '📈', keywords: 'investment stock trading return' },
      { emoji: '📊', keywords: 'analytics business report work' },
      { emoji: '🧾', keywords: 'tax invoice receipt bill' },
      { emoji: '💻', keywords: 'software freelance tech computer' },
      { emoji: '📱', keywords: 'phone mobile contract cell' },
      { emoji: '🌐', keywords: 'internet wifi broadband web' },
      { emoji: '🔒', keywords: 'insurance security safe' },
      { emoji: '🤝', keywords: 'deal client partnership consult' },
      { emoji: '📄', keywords: 'document contract paperwork' },
    ],
  },
  {
    name: 'Shopping',
    items: [
      { emoji: '🛍️', keywords: 'shopping retail purchase mall' },
      { emoji: '👕', keywords: 'clothing shirt fashion apparel' },
      { emoji: '👗', keywords: 'dress clothes fashion outfit' },
      { emoji: '👟', keywords: 'shoes sneakers footwear running' },
      { emoji: '👜', keywords: 'handbag bag purse accessory' },
      { emoji: '💍', keywords: 'jewelry ring luxury accessory' },
      { emoji: '⌚', keywords: 'watch accessory smart' },
      { emoji: '🕶️', keywords: 'sunglasses shades fashion' },
      { emoji: '🎁', keywords: 'gift present birthday holiday' },
      { emoji: '💄', keywords: 'makeup cosmetics beauty lipstick' },
      { emoji: '🖥️', keywords: 'tech monitor hardware computer' },
      { emoji: '🎧', keywords: 'headphones audio music gadget' },
    ],
  },
  {
    name: 'Fun',
    items: [
      { emoji: '🎬', keywords: 'cinema movies theater film' },
      { emoji: '🍿', keywords: 'popcorn movies cinema snack' },
      { emoji: '🎮', keywords: 'gaming video game play station' },
      { emoji: '🎵', keywords: 'music concerts spotify stream' },
      { emoji: '🎟️', keywords: 'tickets concert event show' },
      { emoji: '⚽', keywords: 'football soccer sports match' },
      { emoji: '🏀', keywords: 'basketball sports game' },
      { emoji: '🎾', keywords: 'tennis sports court' },
      { emoji: '🎲', keywords: 'board games dice tabletop' },
      { emoji: '🎨', keywords: 'art museum gallery craft painting' },
      { emoji: '📸', keywords: 'photo photography camera hobby' },
      { emoji: '🏕️', keywords: 'camping outdoor adventure tent' },
      { emoji: '🎉', keywords: 'party celebration event club' },
      { emoji: '🌟', keywords: 'bonus reward special star' },
    ],
  },
  {
    name: 'Other',
    items: [
      { emoji: '🏷️', keywords: 'other general miscellaneous tag' },
      { emoji: '📌', keywords: 'pin note remind other' },
      { emoji: '📎', keywords: 'paperclip office supply other' },
      { emoji: '⭐', keywords: 'star favorite other' },
      { emoji: '❤️', keywords: 'charity donation give heart' },
      { emoji: '🕊️', keywords: 'peace donation cause' },
    ],
  },
];

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  onSaveCategory,
  onDeleteCategory,
  onUnarchiveCategory,
  initialType = 'expense',
}) => {
  const [activeTab, setActiveTab] = useState<'expense' | 'income' | 'archived'>(initialType);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Form states
  const [formType, setFormType] = useState<TransactionType>(initialType);
  const [formName, setFormName] = useState<string>('');
  const [formEmoji, setFormEmoji] = useState<string>('🏷️');
  const [formColor, setFormColor] = useState<string>(WARM_CHART_COLORS[0]);
  const [emojiSearch, setEmojiSearch] = useState<string>('');

  const isFormOpen = isCreating || Boolean(editingCategory);
  const { zIndex } = useModalStack('category_manager_modal', isOpen, onClose);

  const expenseCategories = categories.filter((c) => c.type === 'expense' && !c.isArchived);
  const incomeCategories = categories.filter((c) => c.type === 'income' && !c.isArchived);
  const archivedCategories = categories.filter((c) => c.isArchived);

  // Filtered emoji groups by search query
  const filteredEmojiGroups = useMemo(() => {
    const q = emojiSearch.trim().toLowerCase();
    if (!q) return EMOJI_GROUPS;

    return EMOJI_GROUPS.map((group) => ({
      name: group.name,
      items: group.items.filter((item) => item.keywords.includes(q) || item.emoji.includes(q)),
    })).filter((group) => group.items.length > 0);
  }, [emojiSearch]);

  if (!isOpen) return null;

  const handleStartCreate = (type: TransactionType) => {
    setIsCreating(true);
    setEditingCategory(null);
    setFormType(type);
    setFormName('');
    setFormEmoji(type === 'expense' ? '🍕' : '💼');
    setFormColor(WARM_CHART_COLORS[0]);
    setEmojiSearch('');
  };

  const handleStartEdit = (category: Category) => {
    setEditingCategory(category);
    setIsCreating(false);
    setFormType(category.type);
    setFormName(category.name);
    setFormEmoji(category.emoji);
    setFormColor(category.color || WARM_CHART_COLORS[0]);
    setEmojiSearch('');
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingCategory) {
      await onSaveCategory({
        ...editingCategory,
        name: formName.trim(),
        emoji: formEmoji.trim() || '🏷️',
        color: formColor,
        type: formType,
      });
    } else {
      const newCategory: Category = {
        id: `cat_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: formName.trim(),
        emoji: formEmoji.trim() || '🏷️',
        color: formColor,
        type: formType,
        isArchived: false,
        isDefault: false,
      };
      await onSaveCategory(newCategory);
    }

    setIsCreating(false);
    setEditingCategory(null);
  };

  const handleDelete = async (category: Category) => {
    await onDeleteCategory(category.id);
  };

  const handleUnarchive = async (category: Category) => {
    await onUnarchiveCategory(category.id);
  };

  return (
    <AdaptiveModal
      id="category_manager_modal"
      isOpen={isOpen}
      onClose={onClose}
    >
        {/* ================= FORM VIEW (TARGET 6) ================= */}
        {isFormOpen ? (
          <form onSubmit={handleSaveForm} className="flex flex-col h-full overflow-hidden">
            {/* Header: Cancel on left, "New category" in center, "Save" in amber on right */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingCategory(null);
                }}
                className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Cancel
              </button>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                {editingCategory ? 'Edit category' : 'New category'}
              </h3>
              <button
                type="submit"
                disabled={!formName.trim()}
                className="text-xs font-bold text-[var(--accent)] hover:opacity-80 disabled:opacity-40 cursor-pointer"
              >
                Save
              </button>
            </div>

            {/* Scrollable form body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5">
              {/* Emoji preview next to name field (no separate card) */}
              <div className="flex items-center gap-3">
                <span className="text-3xl shrink-0 p-1">
                  {formEmoji || '🏷️'}
                </span>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Category name"
                  className="flex-1 text-base font-semibold text-[var(--text-primary)] bg-transparent border-b border-[var(--border-subtle)] pb-1.5 focus:border-[var(--accent)] outline-none"
                  autoFocus
                />
              </div>

              {/* Expense / Income Switch */}
              <div className="flex items-center bg-[var(--bg-elevated)] p-1 rounded-full w-fit">
                <button
                  type="button"
                  onClick={() => setFormType('expense')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                    formType === 'expense'
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('income')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                    formType === 'income'
                      ? 'bg-[var(--bg-surface)] text-[var(--income)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Income
                </button>
              </div>

              {/* Emoji Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={emojiSearch}
                  onChange={(e) => setEmojiSearch(e.target.value)}
                  placeholder="Search emoji, e.g. dog"
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] focus:outline-none"
                />
              </div>

              {/* Labelled Emoji Groups (~120 emoji) */}
              <div className="space-y-4 pt-1">
                {filteredEmojiGroups.map((group) => (
                  <div key={group.name} className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)] block">
                      {group.name}
                    </span>
                    <div className="grid grid-cols-7 gap-2">
                      {group.items.map((item) => (
                        <button
                          key={item.emoji}
                          type="button"
                          onClick={() => setFormEmoji(item.emoji)}
                          className={`h-10 rounded-xl text-xl flex items-center justify-center transition-all cursor-pointer ${
                            formEmoji === item.emoji
                              ? 'bg-[var(--accent)]/20 ring-2 ring-[var(--accent)] scale-105'
                              : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated)]/75'
                          }`}
                        >
                          {item.emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* 8 Warm Chart Colours ONLY */}
              <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)] block">
                  Color
                </span>
                <div className="flex items-center gap-2.5">
                  {WARM_CHART_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setFormColor(hex)}
                      style={{ backgroundColor: hex }}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                        formColor === hex ? 'ring-2 ring-offset-2 ring-[var(--text-primary)] scale-110' : 'hover:scale-105'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </form>
        ) : (
          /* ================= LIST VIEW (PLAIN ROWS, NO PASTEL CIRCLES) ================= */
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Categories
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Done
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setActiveTab('expense')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                  activeTab === 'expense'
                    ? 'bg-[var(--accent)] text-black'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Expense ({expenseCategories.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('income')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                  activeTab === 'income'
                    ? 'bg-[var(--accent)] text-black'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Income ({incomeCategories.length})
              </button>
              {archivedCategories.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('archived')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                    activeTab === 'archived'
                      ? 'bg-[var(--accent)] text-black'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Archived ({archivedCategories.length})
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-3 space-y-3">
              {activeTab !== 'archived' && (
                <button
                  type="button"
                  onClick={() => handleStartCreate(activeTab)}
                  className="w-full py-3 px-4 rounded-2xl border border-dashed border-[var(--border-subtle)] text-xs font-semibold text-[var(--accent)] hover:bg-[var(--bg-elevated)]/40 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add {activeTab === 'income' ? 'income' : 'expense'} category</span>
                </button>
              )}

              {/* Plain Rows with hairlines */}
              <div className="divide-y divide-[var(--border-subtle)]">
                {(activeTab === 'expense'
                  ? expenseCategories
                  : activeTab === 'income'
                  ? incomeCategories
                  : archivedCategories
                ).map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between py-3 hover:bg-[var(--bg-elevated)]/40 transition-colors"
                  >
                    {/* Emoji alone with no pastel circle */}
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl shrink-0">{cat.emoji}</span>
                      <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {cat.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {cat.isArchived ? (
                        <button
                          type="button"
                          onClick={() => handleUnarchive(cat)}
                          className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(cat)}
                            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(cat)}
                            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--danger)]"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </AdaptiveModal>
  );
};
