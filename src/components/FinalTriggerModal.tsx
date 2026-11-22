import React, { useEffect, useState } from 'react';
import { X, Target, ShieldAlert, RotateCcw, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { fetchCandles } from '../services/api';
import { evaluateFinalTriggerFromCandles } from './calendar/calendarUtils';

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
    entry_time?: string;
    exit_time?: string;
  } | null;
  onSelect: (tradeId: number, trigger?: 'takeProfit' | 'stopLoss') => Promise<void> | void;
}

export default function FinalTriggerModal({
  isOpen,
  onClose,
  trade,
  onSelect,
}: FinalTriggerModalProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [autoResult, setAutoResult] = useState<'takeProfit' | 'stopLoss' | 'none' | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Automatic K-line evaluation on modal open
  useEffect(() => {
    if (!isOpen || !trade) {
      setAutoResult(null);
      setAnalyzeError(null);
      return;
    }

    const sl = trade.stop_loss;
    const tp = trade.take_profit;
    const exitTime = trade.exit_time || (trade as any).exitTime;

    if (sl == null || tp == null || !exitTime) {
      setAutoResult(null);
      return;
    }

    let isMounted = true;
    setAnalyzing(true);
    setAnalyzeError(null);

    const candleReq = fetchCandles({
      symbol: trade.symbol,
      timeframe: 'M5',
      count: 288,
      start: exitTime,
      price: trade.entryprice,
    });
    if (!candleReq || typeof candleReq.then !== 'function') {
      setAnalyzing(false);
      return;
    }
    candleReq
      .then((res) => {
        if (!isMounted) return;
        if (res && Array.isArray(res.candles) && res.candles.length > 0) {
          const evalResult = evaluateFinalTriggerFromCandles({
            direction: trade.direction,
            stopLoss: sl,
            takeProfit: tp,
            exitTime,
            candles: res.candles,
          });
          setAutoResult(evalResult || 'none');
        } else {
          setAutoResult('none');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setAnalyzeError(err?.message || 'K线计算异常');
      })
      .finally(() => {
        if (isMounted) setAnalyzing(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, trade?.id]);

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

        {/* K-line Automatic Detection Banner */}
        <div className="mt-3 p-3 rounded-xl border border-purple-500/20 bg-purple-50/40 dark:bg-purple-950/20">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300">
              <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>K线数据智能自动计算</span>
            </div>
            {analyzing && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 dark:text-purple-400 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                正在回溯K线...
              </span>
            )}
          </div>

          {analyzing ? (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              正在从平仓时间之后的连续K线中回溯检测是否触碰止盈或止损目标位...
            </p>
          ) : autoResult === 'takeProfit' ? (
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="text-[11px] text-emerald-700 dark:text-emerald-300">
                <p className="font-semibold">🎯 智能检测：行情后续已触及目标止盈位 (达止盈)</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">平仓后价格继续按原计划运行达到预设止盈价</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onSelect(trade.id, 'takeProfit');
                  onClose();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition shrink-0 cursor-pointer"
              >
                <span>一键应用</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ) : autoResult === 'stopLoss' ? (
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="text-[11px] text-rose-700 dark:text-rose-300">
                <p className="font-semibold">🛡️ 智能检测：行情后续已触及保护止损位 (达止损)</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">平仓后价格反向回调跌破了预设止损价</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onSelect(trade.id, 'stopLoss');
                  onClose();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition shrink-0 cursor-pointer"
              >
                <span>一键应用</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ) : autoResult === 'none' ? (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              📊 经平仓后K线回溯比对：在后续观察窗口内价格均未触碰设定的止盈或止损位。
            </p>
          ) : (!trade.stop_loss || !trade.take_profit) ? (
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              ℹ️ 该订单未设置止损或止盈价，无法基于目标价位自动回溯K线。
            </p>
          ) : (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              可根据下方选项手动选择，或查看K线图表核实。
            </p>
          )}
        </div>

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
                  <span className="text-sm font-bold text-gray-900 dark:text-white">最终价格达止盈</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    达止盈 (TP)
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
                  <span className="text-sm font-bold text-gray-900 dark:text-white">最终价格达止损</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300">
                    达止损 (SL)
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
                <p className="text-[11px] text-gray-400 dark:text-gray-500">不记录后续价格是否达止盈或达止损</p>
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
