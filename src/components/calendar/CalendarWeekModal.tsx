import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trade, DayStats } from './calendarTypes';
import {
  computeDayStats,
  formatCurrency,
  getTradeDirection,
  getTradeEntryPrice,
  getTradeExitPrice,
  getTradeSize,
  calculateTradePnL,
} from './calendarUtils';
import { X, Calendar, TrendingUp, Layers, ChevronRight } from 'lucide-react';

interface CalendarWeekModalProps {
  weekIndex: number;
  weekDates: string[];
  tradesByDay: Record<string, Trade[]>;
  onClose: () => void;
  onSelectDay: (dateStr: string) => void;
}

const WEEKDAY_NAMES = ['周一 (Mon)', '周二 (Tue)', '周三 (Wed)', '周四 (Thu)', '周五 (Fri)', '周六 (Sat)', '周日 (Sun)'];

export const CalendarWeekModal: React.FC<CalendarWeekModalProps> = ({
  weekIndex,
  weekDates,
  tradesByDay,
  onClose,
  onSelectDay,
}) => {
  const weekTrades = weekDates.flatMap((d) => tradesByDay[d] || []);
  const weekStats = computeDayStats(weekTrades);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.preventDefault()}
      />

      <div
        role="dialog"
        aria-label="周度复盘汇总弹窗"
        className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[1000] w-full max-w-2xl max-h-[85vh] bg-white dark:bg-[#0f172a] rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/60 dark:bg-navy-950/60">
          <div>
            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">
              <Calendar className="w-3.5 h-3.5 text-purple-500" />
              <span>周度复盘汇总 (Weekly Performance Breakdown)</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              第 {weekIndex + 1} 周绩效 · {weekDates[0]} ~ {weekDates[weekDates.length - 1]}
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                weekStats.pnl >= 0
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
              }`}
            >
              {formatCurrency(weekStats.pnl)}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-navy-800 transition"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-5 space-y-5">
          {/* Summary Stat Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-navy-900/50 border border-gray-100 dark:border-white/5">
              <div className="text-[11px] text-gray-400 mb-0.5">周累计盈亏</div>
              <div className={`text-base font-bold font-mono ${weekStats.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {formatCurrency(weekStats.pnl)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-navy-900/50 border border-gray-100 dark:border-white/5">
              <div className="text-[11px] text-gray-400 mb-0.5">周胜率</div>
              <div className="text-base font-bold font-mono text-gray-900 dark:text-white">
                {weekStats.winRate.toFixed(1)}%
              </div>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-navy-900/50 border border-gray-100 dark:border-white/5">
              <div className="text-[11px] text-gray-400 mb-0.5">周总订单</div>
              <div className="text-base font-bold font-mono text-gray-900 dark:text-white">
                {weekStats.count} 笔
              </div>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-navy-900/50 border border-gray-100 dark:border-white/5">
              <div className="text-[11px] text-gray-400 mb-0.5">周总手数</div>
              <div className="text-base font-bold font-mono text-gray-900 dark:text-white">
                {weekStats.totalVolume.toFixed(2)} Lots
              </div>
            </div>
          </div>

          {/* Daily Breakdown Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300">本周逐日表现 (Monday ~ Sunday)</h3>
            <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 dark:bg-navy-900 text-gray-500 dark:text-gray-400 font-semibold border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="py-2.5 px-3">日期</th>
                    <th className="py-2.5 px-3">星期</th>
                    <th className="py-2.5 px-3">当日净利润</th>
                    <th className="py-2.5 px-3">订单 / 胜率</th>
                    <th className="py-2.5 px-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-mono">
                  {weekDates.map((d, idx) => {
                    const dayTrades = tradesByDay[d] || [];
                    const ds = computeDayStats(dayTrades, d);
                    const hasTrades = dayTrades.length > 0;

                    return (
                      <tr
                        key={d}
                        className="hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition cursor-pointer"
                        onClick={() => {
                          onClose();
                          onSelectDay(d);
                        }}
                      >
                        <td className="py-2.5 px-3 font-bold text-gray-800 dark:text-gray-200">{d}</td>
                        <td className="py-2.5 px-3 font-sans text-gray-500">{WEEKDAY_NAMES[idx] || '-'}</td>
                        <td className="py-2.5 px-3">
                          {hasTrades ? (
                            <span className={`font-bold ${ds.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {formatCurrency(ds.pnl)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {hasTrades ? (
                            <span>{ds.count}单 ({ds.winRate.toFixed(0)}%)</span>
                          ) : (
                            <span className="text-gray-400 font-sans">休市/无交易</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            className="text-purple-600 dark:text-purple-400 hover:underline flex items-center justify-end space-x-0.5 ml-auto font-sans text-[11px]"
                          >
                            <span>进入复盘</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};
