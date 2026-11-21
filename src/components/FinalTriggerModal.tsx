import React, { useEffect } from 'react';
import { X, Target, ShieldAlert, RotateCcw } from 'lucide-react';

export interface FinalTriggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  trade: {
    id: number;
    symbol: string;
    direction?: 'long' | 'short';
    final_trigger?: 'takeProfit' | 'stopLoss';
    finalTrigger?: 'takeProfit' | 'stopLoss';
    entryprice?: number;
    exitprice?: number;
    take_profit?: number;
    stop_loss?: number;
  } | null;
  onSelect: (tradeId: number, trigger?: 'takeProfit' | 'stopLoss') => Promise<void> | void;
}

export default function FinalTriggerModal({
  isOpen,
  onClose,
  trade,
  onSelect,
}: FinalTriggerModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !trade) return null;

  const currentTrigger = trade.final_trigger || trade.finalTrigger;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white dark:bg-[#0b0f19] rounded-2xl border border-gray-200/90 dark:border-white/10 shadow-2xl p-5 sm:p-6 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between pb-3.5 border-b border-gray-100 dark:border-white/5">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                手动平仓 · 标记最终价格走势
              </h3>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-800 dark:text-gray-200">{trade.symbol}</span>
              <span>•</span>
              <span className={trade.direction === 'long' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold'}>
                {trade.direction === 'long' ? '做多 BUY' : '做空 SELL'}
              </span>
              {trade.exitprice && (
                <>
                  <span>•</span>
                  <span>平仓价: <b className="font-mono text-gray-700 dark:text-gray-300">{trade.exitprice}</b></span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options Description */}
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          手动提前离场后，后续行情的最终价格是否触碰了设定的止盈或止损目标？
        </p>

        {/* Action Options */}
        <div className="mt-4 space-y-2.5">
          {/* Take Profit Option */}
          <button
            type="button"
            onClick={async () => {
              await onSelect(trade.id, 'takeProfit');
              onClose();
            }}
            className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
              currentTrigger === 'takeProfit'
                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-800 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                : 'bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/10 hover:border-emerald-500/40 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">最终价格打止盈</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    打止盈 (TP)
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  行情后续继续朝着有利方向运行，并达到原计划目标止盈位
                </p>
              </div>
            </div>
            {currentTrigger === 'takeProfit' && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                当前生效
              </span>
            )}
          </button>

          {/* Stop Loss Option */}
          <button
            type="button"
            onClick={async () => {
              await onSelect(trade.id, 'stopLoss');
              onClose();
            }}
            className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
              currentTrigger === 'stopLoss'
                ? 'bg-rose-500/10 border-rose-500/50 text-rose-800 dark:text-rose-200 ring-2 ring-rose-500/20'
                : 'bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/10 hover:border-rose-500/40 hover:bg-rose-50/50 dark:hover:bg-rose-950/20'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-500/15 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">最终价格打止损</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300">
                    打止损 (SL)
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  行情后续出现反向回撤，并跌破或触碰了保护止损位
                </p>
              </div>
            </div>
            {currentTrigger === 'stopLoss' && (
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 shrink-0">
                当前生效
              </span>
            )}
          </button>

          {/* Clear / Unset Option */}
          <button
            type="button"
            onClick={async () => {
              await onSelect(trade.id, undefined);
              onClose();
            }}
            className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
              !currentTrigger
                ? 'bg-gray-100/80 dark:bg-white/5 border-gray-300 dark:border-white/20 text-gray-800 dark:text-gray-200'
                : 'bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">仅手动平仓 (清除标记)</span>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">不记录后续价格是否打止盈或打止损</p>
              </div>
            </div>
            {!currentTrigger && (
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">
                当前状态
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
