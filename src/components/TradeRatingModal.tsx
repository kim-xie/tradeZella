import React, { useState, useEffect } from 'react';
import { X, Star, RotateCcw } from 'lucide-react';

export interface TradeRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  trade: {
    id: number;
    symbol: string;
    direction?: 'long' | 'short';
    rating?: number;
    entry_time?: string;
    size?: number;
    entryprice?: number;
    exitprice?: number;
  } | null;
  onSelectRating: (tradeId: number, rating: number) => Promise<void> | void;
}

const STAR_META: Record<number, {
  label: string;
  hint: string;
  colorClass: string;
  badgeClass: string;
}> = {
  1: {
    label: '1星 · 严重违规',
    hint: '冲动追单或未设止损，严重偏离纪律',
    colorClass: 'text-rose-500 fill-rose-500',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
  },
  2: {
    label: '2星 · 执行欠佳',
    hint: '入场稍显仓促或提前平仓，存在侥幸心理',
    colorClass: 'text-orange-500 fill-orange-500',
    badgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25',
  },
  3: {
    label: '3星 · 基本合格',
    hint: '守住纪律底线，按既定策略操作，无重大失误',
    colorClass: 'text-amber-400 fill-amber-400',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
  },
  4: {
    label: '4星 · 良好执行',
    hint: '严格遵守开仓与止盈止损规则，专注理性',
    colorClass: 'text-emerald-500 fill-emerald-500',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
  },
  5: {
    label: '5星 · 知行合一',
    hint: '心如止水严格执行系统，极佳耐心与纪律典范！',
    colorClass: 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]',
    badgeClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30',
  },
};

export default function TradeRatingModal({
  isOpen,
  onClose,
  trade,
  onSelectRating,
}: TradeRatingModalProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setHoverRating(null);
    }
  }, [isOpen]);

  // Keyboard shortcut listener
  useEffect(() => {
    if (!isOpen || !trade) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key >= '1' && e.key <= '5') {
        const star = parseInt(e.key, 10);
        onSelectRating(trade.id, star);
        onClose();
      }
      if (e.key === '0') {
        onSelectRating(trade.id, 0);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, trade, onClose, onSelectRating]);

  if (!isOpen || !trade) return null;

  const currentRating = trade.rating || 0;
  const activeRating = hoverRating !== null ? hoverRating : currentRating;
  const activeMeta = activeRating > 0 ? STAR_META[activeRating] : null;

  const handlePickStar = (star: number) => {
    onSelectRating(trade.id, star);
    onClose();
  };

  const handleClear = () => {
    onSelectRating(trade.id, 0);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.preventDefault()}
      />

      {/* Centered Modal */}
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none"
        onWheel={(e) => e.stopPropagation()}
      >
        <div 
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto relative w-full max-w-md bg-white dark:bg-[#0c101c] rounded-2xl shadow-2xl border border-gray-200/90 dark:border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.02]">
            <div className="flex items-center space-x-2.5">
              <span className="p-1.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                  <span>设置交易纪律评分</span>
                  <span className="text-xs font-mono font-medium text-gray-400 dark:text-gray-500">
                    #{trade.id}
                  </span>
                </h3>
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center space-x-1.5 mt-0.5 font-mono">
                  <span className="font-bold text-gray-800 dark:text-gray-200">{trade.symbol}</span>
                  {trade.direction && (
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      trade.direction === 'long' 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    }`}>
                      {trade.direction === 'long' ? '多 BUY' : '空 SELL'}
                    </span>
                  )}
                  {trade.size != null && <span>· {trade.size}手</span>}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Star Selection Area */}
          <div className="px-6 py-6 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
              点击对应星级完成纪律设定，弹窗将自动关闭并展示专属执行动效
            </p>

            {/* Large Interactive Star Buttons */}
            <div className="flex items-center justify-center space-x-3 sm:space-x-4">
              {[1, 2, 3, 4, 5].map((star) => {
                const isLit = (hoverRating !== null ? hoverRating : currentRating) >= star;
                const isCurrentChoice = currentRating === star;
                const starColor = star === 1 ? 'text-rose-500 fill-rose-500' :
                                  star === 2 ? 'text-orange-500 fill-orange-500' :
                                  star === 3 ? 'text-amber-400 fill-amber-400' :
                                  star === 4 ? 'text-emerald-500 fill-emerald-500' :
                                  'text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.7)]';
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    onClick={() => handlePickStar(star)}
                    className={`group relative p-2.5 rounded-2xl transition-all duration-150 transform cursor-pointer ${
                      isLit
                        ? 'scale-110 -translate-y-1 shadow-md bg-white dark:bg-[#131b2e] border border-gray-200 dark:border-white/10'
                        : 'opacity-40 hover:opacity-90 hover:scale-105'
                    } ${
                      isCurrentChoice
                        ? 'ring-2 ring-purple-500/60'
                        : ''
                    }`}
                    title={`评定为 ${star} 星`}
                  >
                    <Star
                      className={`w-9 h-9 sm:w-10 sm:h-10 transition-transform duration-150 group-hover:scale-110 ${
                        isLit ? starColor : 'text-gray-300 dark:text-gray-600'
                      }`}
                    />
                    <span className="block text-[11px] font-mono font-bold text-center mt-1.5 text-gray-600 dark:text-gray-300">
                      {star}星
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Hover / Current Star Description Card */}
            <div className="mt-6 min-h-[48px] flex flex-col items-center justify-center">
              {activeMeta ? (
                <div className="animate-in fade-in duration-150 flex flex-col items-center">
                  <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border mb-1 ${activeMeta.badgeClass}`}>
                    {activeMeta.label}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mt-0.5">
                    {activeMeta.hint}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  按数字键 1~5 亦可键盘快捷评分
                </p>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-6 py-3.5 bg-gray-50/80 dark:bg-white/[0.02] border-t border-gray-100 dark:border-white/5">
            <div>
              {currentRating > 0 ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition flex items-center space-x-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>清空评分</span>
                </button>
              ) : (
                <span className="text-xs text-gray-400 font-mono">点击星级直接完成</span>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200/70 dark:hover:bg-white/10 rounded-xl transition"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
