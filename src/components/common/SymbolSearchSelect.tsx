import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Sparkles } from 'lucide-react';

interface SymbolSearchSelectProps {
  value: string;
  onChange: (symbol: string) => void;
  symbols: string[];
  popularSymbols?: string[];
  placeholder?: string;
  className?: string;
}

export default function SymbolSearchSelect({
  value,
  onChange,
  symbols = [],
  popularSymbols = [],
  placeholder = '搜索或输入品种 (如 EURUSD, 纳斯达克100)',
  className = '',
}: SymbolSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (searchQuery.trim()) {
          const exactMatch = symbols.find(s => s.toLowerCase() === searchQuery.trim().toLowerCase());
          if (exactMatch) {
            onChange(exactMatch);
          } else {
            const formatted = /[a-zA-Z]/.test(searchQuery.trim()) && !/[\u4e00-\u9fa5]/.test(searchQuery.trim())
              ? searchQuery.trim().toUpperCase()
              : searchQuery.trim();
            onChange(formatted);
          }
        }
        setSearchQuery('');
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchQuery, symbols, onChange]);

  // Filter symbols based on query
  const filteredSymbols = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      // If empty query, show popular first, then others
      const popularSet = new Set(popularSymbols);
      const rest = symbols.filter(s => !popularSet.has(s));
      return [...popularSymbols, ...rest];
    }

    return symbols.filter(s => s.toLowerCase().includes(q));
  }, [searchQuery, symbols, popularSymbols]);

  // Keep highlighted index in bound
  useEffect(() => {
    setHighlightIndex(0);
  }, [searchQuery]);

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[highlightIndex] as HTMLElement;
      if (activeEl && typeof activeEl.scrollIntoView === 'function') {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightIndex, isOpen]);

  const handleSelect = (sym: string) => {
    const formatted = /[a-zA-Z]/.test(sym) && !/[\u4e00-\u9fa5]/.test(sym) ? sym.toUpperCase() : sym;
    onChange(formatted);
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => (prev < filteredSymbols.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredSymbols.length > 0 && highlightIndex >= 0 && highlightIndex < filteredSymbols.length) {
        handleSelect(filteredSymbols[highlightIndex]);
      } else if (searchQuery.trim()) {
        handleSelect(searchQuery.trim());
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input bar */}
      <div 
        className="relative flex items-center bg-white dark:bg-navy-800 border border-gray-300 dark:border-gray-600 rounded-lg focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500 transition-all shadow-sm"
      >
        <div className="pl-3 pr-2 text-gray-400 pointer-events-none">
          <Search className="w-4 h-4" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchQuery : value}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setSearchQuery('');
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={isOpen ? (value || placeholder) : (value || placeholder)}
          className="w-full py-2 pr-16 text-xs sm:text-sm bg-transparent border-0 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-0 font-medium"
        />

        {/* Clear & Dropdown toggle buttons */}
        <div className="absolute right-2 flex items-center space-x-1">
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsOpen(!isOpen);
              if (!isOpen) inputRef.current?.focus();
            }}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute z-50 mt-1.5 w-full bg-white dark:bg-navy-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header count info */}
          <div className="px-3 py-1.5 bg-gray-50 dark:bg-navy-700/60 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between text-[11px] text-gray-400">
            <span>
              {searchQuery.trim() 
                ? `检索结果 (${filteredSymbols.length})` 
                : `全部品种 (${symbols.length || filteredSymbols.length})`}
            </span>
            <span className="text-[10px]">支持中英文模糊检索</span>
          </div>

          {/* List items */}
          <ul 
            ref={listRef}
            className="max-h-60 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800 text-xs py-1"
          >
            {filteredSymbols.length > 0 ? (
              filteredSymbols.slice(0, 100).map((sym, idx) => {
                const isSelected = sym === value;
                const isHighlighted = idx === highlightIndex;
                const isPopular = popularSymbols.includes(sym) && !searchQuery;

                return (
                  <li
                    key={sym}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    onClick={() => handleSelect(sym)}
                    className={`px-3 py-2 cursor-pointer flex items-center justify-between transition-colors ${
                      isHighlighted 
                        ? 'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' 
                        : 'text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      {isPopular && (
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      )}
                      <span className={`font-medium ${isSelected ? 'text-purple-600 dark:text-purple-400 font-bold' : ''}`}>
                        {sym}
                      </span>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    )}
                  </li>
                );
              })
            ) : (
              <li className="px-3 py-4 text-center text-gray-400">
                <p>未找到匹配的标的代码</p>
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => handleSelect(searchQuery.trim())}
                    className="mt-2 px-3 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 rounded text-[11px] font-medium hover:underline"
                  >
                    直接使用自定义代码: <b>{searchQuery.trim()}</b>
                  </button>
                )}
              </li>
            )}

            {filteredSymbols.length > 100 && (
              <li className="px-3 py-2 text-center text-[11px] text-gray-400 bg-gray-50/50 dark:bg-navy-700/30">
                仅展示前 100 项，请输入更详细关键词以精确过滤
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
