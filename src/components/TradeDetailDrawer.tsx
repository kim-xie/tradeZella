import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Maximize2,
  Minimize2,
  RefreshCw,
  PenLine,
  Star,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Button from './common/Button';
import { TradeExecutionChart } from './TradeExecutionChart';
import ErrorBoundary from './common/ErrorBoundary';
import { SERVER_BASE_URL as API_BASE_URL } from '../services/api';
import {
  getTradeTradingDate,
  isTradeOvernightSession,
} from './calendar/calendarUtils';

export interface DetailTrade {
  id: number;
  symbol: string;
  direction: 'long' | 'short';
  size: number;
  entryprice: number;
  exitprice?: number;
  notes?: string;
  trade_date?: string;
  tags?: string[] | string;
  sentiment?: string;
  createdat: string;
  updatedat?: string;
  screenshots?: string[];
  entry_time?: string;
  exit_time?: string;
  stop_loss?: number;
  take_profit?: number;
  entry_conditions?: string[];
  rating?: number;
  leverage?: number;
  manual_pnl?: number;
  session?: 'Asia' | 'Europe' | 'US';
  final_trigger?: 'takeProfit' | 'stopLoss';
}

export interface TradeDetailDrawerProps {
  trade: DetailTrade | null;
  onClose: () => void;
}

type ExitMethodType = 'takeProfit' | 'stopLoss' | 'manual';
const SENTIMENT_EMOJI: Record<string, string> = {
  Nervous: '😰',
  Uneasy: '😟',
  Neutral: '😐',
  Composed: '😌',
  Zen: '🧘',
};

const formatDuration = (entryTime?: string, exitTime?: string): string => {
  if (!entryTime || !exitTime) return '-';
  const start = new Date(entryTime).getTime();
  const end = new Date(exitTime).getTime();
  const diff = end - start;
  if (isNaN(diff) || diff < 0) return '-';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(' ');
};

const formatLocalTime = (dateStr?: string): string => {
  if (!dateStr) return '-';
  const normalized = dateStr.replace(' ', 'T');
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return '-';
  return `${match[1]}/${match[2]}/${match[3]} ${match[4]}:${match[5]}`;
};

const formatLocalTimeFull = (dateStr?: string): string => {
  if (!dateStr) return '-';
  const normalized = dateStr.replace(' ', 'T');
  const m = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return '-';
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
};

export const calculateTargetRR = (trade: DetailTrade): number | null => {
  const ep = Number(trade.entryprice ?? (trade as any).entryPrice ?? 0);
  const sl = Number(trade.stop_loss ?? (trade as any).stopLoss ?? 0);
  const tp = Number(trade.take_profit ?? (trade as any).takeProfit ?? 0);

  if (ep <= 0 || sl <= 0 || tp <= 0) return null;
  const risk = Math.abs(ep - sl);
  const reward = Math.abs(tp - ep);
  if (risk <= 0.0000001 || reward <= 0.0000001) return null;
  const rr = reward / risk;
  return isFinite(rr) && rr > 0 ? rr : null;
};

export const calculateActualRR = (trade: DetailTrade): number | null => {
  const ep = Number(trade.entryprice ?? (trade as any).entryPrice ?? 0);
  const sl = Number(trade.stop_loss ?? (trade as any).stopLoss ?? 0);
  const xp = Number(trade.exitprice ?? (trade as any).exitPrice ?? 0);

  if (ep <= 0 || sl <= 0 || xp <= 0) return null;
  const riskPerUnit = Math.abs(ep - sl);
  if (riskPerUnit <= 0.0000001) return null;

  const dir = trade.direction === 'short' || trade.direction === ('sell' as any) ? 'short' : 'long';
  const diff = dir === 'long' ? xp - ep : ep - xp;
  const manual = trade.manual_pnl ?? (trade as any).manualPnl;
  const isManual = manual !== undefined && manual !== null && !isNaN(Number(manual));

  if (isManual && diff !== 0) {
    const pnl = Number(manual);
    const sign = pnl === 0 ? 0 : pnl > 0 ? 1 : -1;
    const rr = sign * (Math.abs(diff) / riskPerUnit);
    return isFinite(rr) ? rr : null;
  }
  const rr = diff / riskPerUnit;
  return isFinite(rr) ? rr : null;
};

export const calculateTradePnL = (
  trade: DetailTrade
): { pnl: number; pnlPercent: number; rr: number | null; targetRR: number | null; isManual: boolean } | null => {
  if (!trade.exitprice || !trade.entryprice || trade.size <= 0) return null;
  const leverage = trade.leverage && trade.leverage >= 1 ? trade.leverage : 1;
  const isManual = trade.manual_pnl !== undefined && trade.manual_pnl !== null && !isNaN(trade.manual_pnl);

  const diff = trade.direction === 'long'
    ? trade.exitprice - trade.entryprice
    : trade.entryprice - trade.exitprice;

  const pnl = isManual ? trade.manual_pnl! : diff * trade.size * leverage;
  const cost = trade.entryprice * trade.size;
  const pnlPercent = isManual
    ? (cost > 0 ? (pnl / cost) * 100 : 0)
    : (diff / trade.entryprice) * 100 * leverage;

  const actualRR = calculateActualRR(trade);
  const targetRR = calculateTargetRR(trade);

  return { pnl, pnlPercent, rr: actualRR, targetRR, isManual };
};

export const calculateExitMethod = (trade: DetailTrade): ExitMethodType | null => {
  if (trade.final_trigger === 'takeProfit') return 'takeProfit';
  if (trade.final_trigger === 'stopLoss') return 'stopLoss';

  if (trade.notes) {
    const lower = trade.notes.toLowerCase();
    if (lower.includes('[tp') || lower.includes('take profit')) return 'takeProfit';
    if (lower.includes('[sl') || lower.includes('stop loss')) return 'stopLoss';
  }

  if (trade.exitprice == null) return null;

  const exit = trade.exitprice;
  const sl = trade.stop_loss;
  const tp = trade.take_profit;

  if (trade.direction === 'long') {
    if (tp != null && exit >= tp) return 'takeProfit';
    if (sl != null && exit <= sl) return 'stopLoss';
    return 'manual';
  } else {
    if (tp != null && exit <= tp) return 'takeProfit';
    if (sl != null && exit >= sl) return 'stopLoss';
    return 'manual';
  }
};

export interface TradeSourceInfo {
  type: 'synced' | 'manual';
  label: string;
}

export const getTradeSource = (trade: DetailTrade): TradeSourceInfo => {
  const tags = Array.isArray(trade.tags)
    ? trade.tags
    : typeof trade.tags === 'string'
    ? (() => {
        try {
          const parsed = JSON.parse(trade.tags);
          return Array.isArray(parsed) ? parsed : [trade.tags];
        } catch {
          return (trade.tags as string).split(',').map((s) => s.trim()).filter(Boolean);
        }
      })()
    : [];

  const tagsLower = tags.map((t: string) => String(t).toLowerCase());
  const notesLower = String(trade.notes || '').toLowerCase();

  const isEA =
    tagsLower.some((t) => t.includes('mt5') || t.includes('ea') || t.includes('synced') || t.includes('mql')) ||
    notesLower.includes('mt5') ||
    notesLower.includes('ea_sync') ||
    notesLower.includes('ticket:');

  if (isEA) {
    return { type: 'synced', label: 'EA 自动同步' };
  }
  return { type: 'manual', label: '手动录入' };
};

export const TradeDetailDrawer: React.FC<TradeDetailDrawerProps> = ({ trade, onClose }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ urls: string[]; index: number } | null>(null);

  // Background scroll locking
  useEffect(() => {
    if (trade && typeof document !== 'undefined') {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [trade]);

  // Escape key handler
  useEffect(() => {
    if (!trade) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxImage) {
          setLightboxImage(null);
        } else {
          onClose();
        }
      } else if (lightboxImage && lightboxImage.urls.length > 1) {
        if (e.key === 'ArrowLeft') {
          setLightboxImage((prev) =>
            prev ? { ...prev, index: (prev.index - 1 + prev.urls.length) % prev.urls.length } : null
          );
        } else if (e.key === 'ArrowRight') {
          setLightboxImage((prev) =>
            prev ? { ...prev, index: (prev.index + 1) % prev.urls.length } : null
          );
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [trade, lightboxImage, onClose]);

  if (!trade || typeof document === 'undefined') return null;

  const src = getTradeSource(trade);
  const pnlData = calculateTradePnL(trade);
  const targetRR = calculateTargetRR(trade);
  const actualRR = calculateActualRR(trade);
  const exitMethod = calculateExitMethod(trade);
  const isCompleted = !!trade.exitprice;
  const rating = trade.rating || 0;

  const tagsList: string[] = Array.isArray(trade.tags)
    ? trade.tags
    : typeof trade.tags === 'string'
    ? (() => {
        try {
          const parsed = JSON.parse(trade.tags);
          return Array.isArray(parsed) ? parsed : [trade.tags];
        } catch {
          return (trade.tags as string).split(',').map((s) => s.trim()).filter(Boolean);
        }
      })()
    : [];

  const exitStyles: Record<ExitMethodType, string> = {
    takeProfit: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    stopLoss: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    manual: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  };
  const exitLabels: Record<ExitMethodType, string> = {
    takeProfit: '止盈触发',
    stopLoss: '止损触发',
    manual: '手动平仓',
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.preventDefault()}
      />

      {/* Drawer Panel */}
      <aside
        aria-label="交易复盘详情抽屉"
        className={`fixed top-0 right-0 bottom-0 z-[1000] ${
          isMaximized ? 'w-full' : 'w-full md:w-3/5 lg:w-1/2'
        } bg-white dark:bg-[#0f172a] border-l border-gray-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ease-in-out`}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div
            className="p-4 sm:p-5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/60 dark:bg-navy-950/60 shrink-0 select-none"
            onTouchMove={(e) => e.preventDefault()}
          >
            <div>
              <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">
                <FileText className="w-3.5 h-3.5 text-purple-500" />
                <span>交易执行与复盘档案 (Trade Review & Execution)</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">交易复盘详情</h2>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium flex items-center space-x-1 ${
                    src.type === 'synced'
                      ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                      : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {src.type === 'synced' ? (
                    <RefreshCw className="w-2.5 h-2.5 mr-1" />
                  ) : (
                    <PenLine className="w-2.5 h-2.5 mr-1" />
                  )}
                  <span>{src.label}</span>
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {pnlData && (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                    pnlData.pnl >= 0
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                      : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
                  }`}
                >
                  {pnlData.pnl >= 0 ? '+' : ''}${pnlData.pnl.toFixed(2)}
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsMaximized((prev) => !prev)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-navy-800 transition"
                title={isMaximized ? '还原抽屉宽度' : '全屏铺满抽屉'}
                aria-label={isMaximized ? '还原抽屉宽度' : '全屏铺满抽屉'}
              >
                {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-navy-800 transition"
                title="Close drawer"
                aria-label="关闭详情抽屉"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-6 space-y-5">
            {/* TradingView Execution Plotter on K-Line */}
            <div>
              <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>K线买卖执行打点 (TradingView Plotter)</span>
                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono font-normal">
                  ENTRY / EXIT MARKERS
                </span>
              </h4>
              <ErrorBoundary fallbackTitle="单笔订单K线买卖执行打点图表加载异常">
                <TradeExecutionChart
                  symbol={trade.symbol}
                  direction={trade.direction}
                  entryPrice={trade.entryprice}
                  exitPrice={trade.exitprice}
                  stopLoss={trade.stop_loss}
                  takeProfit={trade.take_profit}
                  entryTime={trade.entry_time}
                  exitTime={trade.exit_time}
                  size={trade.size}
                  profit={pnlData?.pnl}
                  pnlPercent={pnlData?.pnlPercent}
                  notes={trade.notes}
                  sentiment={trade.sentiment}
                  tags={trade.tags}
                  session={trade.session}
                  exitReason={exitMethod || undefined}
                  height={320}
                />
              </ErrorBoundary>
            </div>

            {/* Core Metrics Grid */}
            <div className="grid grid-cols-2 gap-4 bg-gray-50/60 dark:bg-navy-900/40 border border-gray-200/80 dark:border-white/10 rounded-2xl p-4 sm:p-5">
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">交易标的:</span>{' '}
                <span className="text-sm font-bold text-gray-900 dark:text-white">{trade.symbol}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">交易方向:</span>{' '}
                <span
                  className={`text-sm font-bold ${
                    trade.direction === 'long' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {trade.direction === 'long' ? '做多 (Long)' : '做空 (Short)'}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">交易规模/手数:</span>{' '}
                <span className="text-sm font-semibold text-gray-900 dark:text-white font-mono">{trade.size}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">结算状态:</span>{' '}
                <span
                  className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                    isCompleted
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}
                >
                  {isCompleted ? '已平仓结算' : '持仓中'}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">所属交易日:</span>{' '}
                <span className="text-sm font-semibold font-mono text-purple-600 dark:text-purple-400">
                  {getTradeTradingDate(trade as any)}
                  {isTradeOvernightSession(trade as any) && ' (跨夜美盘)'}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">入场价格:</span>{' '}
                <span className="text-sm font-semibold text-gray-900 dark:text-white font-mono">{trade.entryprice}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">出场价格:</span>{' '}
                <span className="text-sm font-semibold text-gray-900 dark:text-white font-mono">{trade.exitprice || '-'}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">止损点位 (SL):</span>{' '}
                <span className="text-sm font-semibold text-gray-900 dark:text-white font-mono">{trade.stop_loss || '-'}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">止盈点位 (TP):</span>{' '}
                <span className="text-sm font-semibold text-gray-900 dark:text-white font-mono">{trade.take_profit || '-'}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">入场时间:</span>{' '}
                <span className="text-sm font-medium text-gray-900 dark:text-white">{formatLocalTime(trade.entry_time)}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">出场时间:</span>{' '}
                <span className="text-sm font-medium text-gray-900 dark:text-white">{formatLocalTime(trade.exit_time)}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">持仓时长:</span>{' '}
                <span className="text-sm font-medium text-gray-900 dark:text-white">{formatDuration(trade.entry_time, trade.exit_time)}</span>
              </div>
              {pnlData && (
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">净盈亏:{pnlData.isManual ? ' (手动指定)' : ''}</span>{' '}
                  <span className={`text-sm font-semibold font-mono ${pnlData.pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {pnlData.pnl >= 0 ? '+' : ''}${pnlData.pnl.toFixed(2)} ({pnlData.pnlPercent.toFixed(2)}%)
                  </span>
                </div>
              )}
              {targetRR != null && (
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">目标盈亏比 (设定止盈止损):</span>{' '}
                  <span className="text-sm font-semibold text-gray-900 dark:text-white font-mono">
                    1 : {targetRR.toFixed(2)} ({targetRR.toFixed(1)}R)
                  </span>
                </div>
              )}
              {actualRR != null && (
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">实际出场盈亏比 (Actual R/R):</span>{' '}
                  <span
                    className={`text-sm font-semibold font-mono ${
                      (pnlData?.pnl ?? actualRR) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    1 : {Math.abs(actualRR).toFixed(2)} ({actualRR >= 0 ? '+' : ''}{actualRR.toFixed(1)}R)
                  </span>
                </div>
              )}
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">创建时间:</span>{' '}
                <span className="text-sm font-medium text-gray-900 dark:text-white">{formatLocalTimeFull(trade.createdat)}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">更新时间:</span>{' '}
                <span className="text-sm font-medium text-gray-900 dark:text-white">{formatLocalTimeFull(trade.updatedat)}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">交易时段:</span>{' '}
                <span className="text-sm font-medium text-gray-900 dark:text-white">{trade.session ? `${trade.session} 盘` : '-'}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">入场心智/情绪:</span>{' '}
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {trade.sentiment ? `${SENTIMENT_EMOJI[trade.sentiment] || ''} ${trade.sentiment}` : '-'}
                </span>
              </div>
              {exitMethod && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">平仓方式:</span>
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${exitStyles[exitMethod]}`}>
                    {exitLabels[exitMethod]}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-gray-500 dark:text-gray-400">盈亏结果:</span>
                {!trade.exitprice || !pnlData ? (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">-</span>
                ) : pnlData.pnl > 0 ? (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">盈利</span>
                ) : pnlData.pnl < 0 ? (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">亏损</span>
                ) : (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">保本</span>
                )}
              </div>
              {rating > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">纪律评分:</span>
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={16}
                        className={rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tags */}
            {tagsList.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5 uppercase tracking-wider">
                  策略战法标签:
                </span>
                <div className="flex flex-wrap gap-2">
                  {tagsList.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 text-xs rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Entry conditions */}
            {trade.entry_conditions && trade.entry_conditions.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5 uppercase tracking-wider">
                  入场条件与信号:
                </span>
                <div className="flex flex-wrap gap-2">
                  {trade.entry_conditions.map((condition, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 text-xs rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50"
                    >
                      {condition}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {trade.notes && (
              <div>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5 uppercase tracking-wider">
                  复盘心得与笔记:
                </span>
                <p className="text-sm text-gray-900 dark:text-white bg-gray-50/70 dark:bg-navy-900/40 border border-gray-200/80 dark:border-white/10 p-3.5 rounded-xl leading-relaxed whitespace-pre-wrap">
                  {trade.notes}
                </p>
              </div>
            )}

            {/* Screenshots */}
            {trade.screenshots && trade.screenshots.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-2 uppercase tracking-wider">
                  行情与图表截图:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {trade.screenshots.map((url, i) => {
                    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
                    return (
                      <img
                        key={i}
                        src={fullUrl}
                        alt={`Screenshot ${i + 1}`}
                        onClick={() =>
                          setLightboxImage({
                            urls: trade.screenshots!.map((u) => (u.startsWith('http') ? u : `${API_BASE_URL}${u}`)),
                            index: i,
                          })
                        }
                        className="w-full h-20 object-cover rounded-xl border border-gray-200 dark:border-white/10 cursor-pointer hover:opacity-80 transition-opacity"
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          <div
            className="flex justify-end p-4 border-t border-gray-200 dark:border-white/10 shrink-0 bg-gray-50/60 dark:bg-navy-950/60"
            onTouchMove={(e) => e.preventDefault()}
          >
            <Button variant="gradient" onClick={onClose}>
              关闭
            </Button>
          </div>
        </div>
      </aside>

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[1020] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxImage(null)}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.preventDefault()}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white hover:text-gray-300 bg-gray-800/60 hover:bg-gray-800/90 rounded-full p-2 z-10 transition-colors"
            onClick={() => setLightboxImage(null)}
          >
            <X size={24} />
          </button>
          {lightboxImage.urls.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-gray-800/60 hover:bg-gray-800/90 rounded-full p-2 z-10 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxImage({
                    ...lightboxImage,
                    index: (lightboxImage.index - 1 + lightboxImage.urls.length) % lightboxImage.urls.length,
                  });
                }}
              >
                <ChevronLeft size={24} />
              </button>
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-gray-800/60 hover:bg-gray-800/90 rounded-full p-2 z-10 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxImage({
                    ...lightboxImage,
                    index: (lightboxImage.index + 1) % lightboxImage.urls.length,
                  });
                }}
              >
                <ChevronRight size={24} />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-gray-800/60 px-3 py-1 rounded-full z-10 font-mono">
                {lightboxImage.index + 1} / {lightboxImage.urls.length}
              </div>
            </>
          )}
          <img
            src={lightboxImage.urls[lightboxImage.index]}
            alt="Screenshot preview"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}
    </>,
    document.body
  );
};

export default TradeDetailDrawer;
