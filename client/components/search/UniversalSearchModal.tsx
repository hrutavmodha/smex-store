'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Trophy, Shield, User, ShoppingBag, ArrowRight } from 'lucide-react';

import type {
  SearchCategory,
  SearchResultItem,
  SearchResultsByCategory as SearchResultData,
} from '@smex/shared';

export interface UniversalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UniversalSearchModal({
  isOpen,
  onClose,
}: UniversalSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResultData>({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    setQuery('');
    setResults({});
    setSelectedIndex(0);
    onClose();
  }, [onClose]);

  // Auto-focus on modal open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Flattened results for keyboard navigation
  const flatItems: SearchResultItem[] = useMemo(() => {
    const items: SearchResultItem[] = [];
    if (results.tournaments?.length) {
      results.tournaments.forEach((t) => {
        items.push({
          id: t.id,
          category: 'tournaments',
          title: t.title,
          subtitle: t.gameSlug?.toUpperCase(),
          badge: t.status?.replace(/_/g, ' '),
          url: t.url || `/tournaments/${t.id}`,
        });
      });
    }
    if (results.teams?.length) {
      results.teams.forEach((tm) => {
        items.push({
          id: tm.id,
          category: 'teams',
          title: tm.name,
          subtitle: tm.tag ? `[${tm.tag}]` : undefined,
          badge: tm.gameSlug?.toUpperCase(),
          url: tm.url || `/teams/${tm.id}`,
        });
      });
    }
    if (results.players?.length) {
      results.players.forEach((p) => {
        items.push({
          id: p.id,
          category: 'players',
          title: p.username,
          subtitle: p.ign ? `IGN: ${p.ign}` : undefined,
          badge: p.role,
          url: p.url || `/profile/${p.id}`,
        });
      });
    }
    if (results.marketplace?.length) {
      results.marketplace.forEach((m) => {
        items.push({
          id: m.id,
          category: 'marketplace',
          title: m.title,
          subtitle: m.rankTier,
          badge: m.priceInr ? `₹${m.priceInr}` : undefined,
          url: m.url || `/marketplace/${m.id}`,
        });
      });
    }
    return items;
  }, [results]);

  // 300ms Debounced search fetch
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const handler = setTimeout(async () => {
      setIsLoading(true);
      try {
        const catParam = category !== 'all' ? `&category=${category}` : '';
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(trimmed)}${catParam}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || {});
          setSelectedIndex(0);
        } else {
          setResults({});
        }
      } catch {
        setResults({});
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [query, category, isOpen]);

  // Keyboard navigation across flat results
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }

      if (flatItems.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % flatItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = flatItems[selectedIndex];
        if (selected) {
          handleClose();
          router.push(selected.url);
        }
      }
    },
    [flatItems, selectedIndex, handleClose, router]
  );

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="universal-search-modal"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-[#000000]/80 transition-all duration-[120ms]"
      style={{ backdropFilter: 'none' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-border-subtle bg-[#121C19] shadow-2xl overflow-hidden flex flex-col transition-all duration-[120ms]"
        style={{ backdropFilter: 'none' }}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-subtle bg-[#0B0F12]">
          <Search className="h-5 w-5 text-emerald-primary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              if (val.trim().length < 2) {
                setResults({});
                setIsLoading(false);
              }
            }}
            placeholder="Search tournaments, teams, players, and accounts..."
            data-testid="search-modal-input"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults({});
              }}
              className="p-1 text-text-muted hover:text-text-primary transition-colors duration-[120ms]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-bg-surface-elevated text-text-muted rounded border border-border-subtle">
            ESC
          </kbd>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border-subtle/40 bg-[#0B0F12]/50 overflow-x-auto text-xs">
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'tournaments', label: 'Tournaments' },
              { key: 'teams', label: 'Teams' },
              { key: 'players', label: 'Players' },
              { key: 'marketplace', label: 'Marketplace' },
            ] as const
          ).map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setCategory(cat.key)}
              data-testid={`search-category-${cat.key}`}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors duration-[120ms] ${
                category === cat.key
                  ? 'bg-emerald-primary text-black font-semibold'
                  : 'bg-[#16211D] text-text-muted hover:text-text-primary hover:bg-bg-surface-elevated'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Results Area */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-border-subtle/30 bg-[#121C19]">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-text-muted">
              Searching platform records...
            </div>
          ) : query.trim().length >= 2 && flatItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-muted">
              No results found for &quot;<span className="text-text-primary">{query}</span>&quot;
            </div>
          ) : query.trim().length < 2 ? (
            <div className="py-10 text-center text-xs text-text-muted">
              Type at least 2 characters to search...
            </div>
          ) : (
            flatItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={`${item.category}-${item.id}`}
                  data-testid="search-result-item"
                  onClick={() => {
                    handleClose();
                    router.push(item.url);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors duration-[120ms] ${
                    isSelected
                      ? 'bg-emerald-primary/10 border border-emerald-primary/40 text-text-primary'
                      : 'hover:bg-bg-surface-elevated text-text-secondary'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#16211D] border border-border-subtle text-emerald-primary shrink-0">
                      {item.category === 'tournaments' && <Trophy className="h-4 w-4" />}
                      {item.category === 'teams' && <Shield className="h-4 w-4" />}
                      {item.category === 'players' && <User className="h-4 w-4" />}
                      {item.category === 'marketplace' && <ShoppingBag className="h-4 w-4" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-text-primary truncate">
                        {item.title}
                      </span>
                      {item.subtitle && (
                        <span className="text-[11px] text-text-muted truncate">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.badge && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-border-subtle/30 text-emerald-primary border border-emerald-500/20">
                        {item.badge}
                      </span>
                    )}
                    <ArrowRight className="h-3.5 w-3.5 text-text-muted" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border-subtle bg-[#0B0F12] text-[10px] text-text-muted">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono bg-bg-surface-elevated px-1 py-0.5 rounded border border-border-subtle">
                ↑↓
              </kbd>{' '}
              Navigate
            </span>
            <span>
              <kbd className="font-mono bg-bg-surface-elevated px-1 py-0.5 rounded border border-border-subtle">
                ↵
              </kbd>{' '}
              Select
            </span>
            <span>
              <kbd className="font-mono bg-bg-surface-elevated px-1 py-0.5 rounded border border-border-subtle">
                ESC
              </kbd>{' '}
              Close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
