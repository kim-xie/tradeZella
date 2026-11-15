import React from 'react';
import { MonthStats } from './calendarTypes';
import { formatCurrency } from './calendarUtils';
import { TrendingUp, Award, Calendar } from 'lucide-react';

export interface CalendarMonthBannerProps {
  stats: MonthStats;
  currentDate?: Date;
  title?: string;
  extremesTitle?: string;
}

const MONTH_NAMES = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月'
];

export const CalendarMonthBanner: React.FC<CalendarMonthBannerProps> = ({ 
  stats, 
  currentDate = new Date(),
  title,
  extremesTitle,
}) => {
  const monthName = MONTH_NAMES[currentDate.getMonth()];
  const year = currentDate.getFullYear();
  const totalDays = stats.greenDaysCount + stats.redDaysCount + stats.breakevenDaysCount;
  const greenPct = totalDays > 0 ? (stats.greenDaysCount / totalDays) * 100 : 0;
  const redPct = totalDays > 0 ? (stats.redDaysCount / totalDays) * 100 : 0;

  const displayTitle = title || `${year}年 ${monthName} 净利润`;
  const displayExtremesTitle = extremesTitle || '月度极值与成交量';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 relative z-0">
      {/* 1. Monthly Net P&L */}
      <div className="bg-white dark:bg-[#111827] rounded-xl p-4 border border-gray-200 dark:border-white/10 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
          <span>{displayTitle}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            stats.netPnL >= 0 
              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400' 
              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
          }`}>
            {stats.netPnL >= 0 ? '净盈利' : '净亏损'}
          </span>
        </div>
        <div className={`text-2xl font-black font-mono tracking-tight mb-2 ${
          stats.netPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
        }`}>
          {formatCurrency(stats.netPnL)}
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-white/5 pt-2">
          <span>胜率: <strong className="text-gray-900 dark:text-white font-mono">{stats.winRate.toFixed(1)}%</strong></span>
          <span>盈利/亏损: <span className="text-emerald-500 font-mono">+${Math.round(stats.grossProfit)}</span> / <span className="text-rose-500 font-mono">-${Math.round(stats.grossLoss)}</span></span>
        </div>
      </div>

      {/* 2. Consistency & Green/Red Days */}
      <div className="bg-white dark:bg-[#111827] rounded-xl p-4 border border-gray-200 dark:border-white/10 shadow-xs">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
          <span>交易日纪律分布</span>
          <Calendar className="w-3.5 h-3.5 text-purple-500" />
        </div>
        <div className="flex items-baseline space-x-2 mb-2">
          <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{stats.greenDaysCount} 绿日</span>
          <span className="text-sm text-gray-400 font-mono">/</span>
          <span className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">{stats.redDaysCount} 红日</span>
          {stats.breakevenDaysCount > 0 && (
            <span className="text-xs text-gray-400 font-mono">({stats.breakevenDaysCount} 平)</span>
          )}
        </div>
        {/* Dual-color Progress Bar */}
        <div className="w-full bg-gray-100 dark:bg-navy-900 h-2 rounded-full overflow-hidden flex mb-2">
          <div 
            style={{ width: `${greenPct}%` }} 
            className="bg-emerald-500 transition-all duration-300" 
            title={`盈利日: ${greenPct.toFixed(0)}%`} 
          />
          <div 
            style={{ width: `${redPct}%` }} 
            className="bg-rose-500 transition-all duration-300" 
            title={`亏损日: ${redPct.toFixed(0)}%`} 
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
          <span>绿日占比: <strong className="text-gray-900 dark:text-white font-mono">{greenPct.toFixed(0)}%</strong></span>
          <span>日均: <span className={`font-mono font-bold ${stats.avgDailyPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{formatCurrency(stats.avgDailyPnL)}/天</span></span>
        </div>
      </div>

      {/* 3. Profit Factor & Expectancy */}
      <div className="bg-white dark:bg-[#111827] rounded-xl p-4 border border-gray-200 dark:border-white/10 shadow-xs">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
          <span>盈亏比与系统期望</span>
          <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
        </div>
        <div className="flex items-baseline space-x-2 mb-2">
          <span className="text-2xl font-black font-mono text-gray-900 dark:text-white">
            {stats.profitFactor >= 99 ? '∞' : stats.profitFactor.toFixed(2)}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">盈亏比 (PF)</span>
        </div>
        <div className="space-y-1 text-[11px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-white/5 pt-2">
          <div className="flex justify-between">
            <span>每笔数学期望:</span>
            <span className={`font-mono font-bold ${stats.expectancy >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {formatCurrency(stats.expectancy)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>结算订单数:</span>
            <span className="font-mono text-gray-900 dark:text-white">{stats.completedTrades} / {stats.totalTrades}</span>
          </div>
        </div>
      </div>

      {/* 4. Extremes & Volume */}
      <div className="bg-white dark:bg-[#111827] rounded-xl p-4 border border-gray-200 dark:border-white/10 shadow-xs">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
          <span>{displayExtremesTitle}</span>
          <Award className="w-3.5 h-3.5 text-amber-500" />
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center text-gray-500 dark:text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
              最佳单日:
            </span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {stats.bestDay ? formatCurrency(stats.bestDay.pnl) : '$0.00'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center text-gray-500 dark:text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>
              最大回撤日:
            </span>
            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
              {stats.worstDay ? formatCurrency(stats.worstDay.pnl) : '$0.00'}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-white/5 pt-2 mt-2">
          <span>总交易量: <strong className="text-gray-900 dark:text-white font-mono">{stats.totalVolume.toFixed(2)} 手</strong></span>
          <span>活跃交易日: <strong className="text-gray-900 dark:text-white font-mono">{stats.tradingDaysCount} 天</strong></span>
        </div>
      </div>
    </div>
  );
};
