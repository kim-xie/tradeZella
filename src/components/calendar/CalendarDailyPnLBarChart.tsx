import React, { useMemo, useState } from 'react';
import { Trade } from './calendarTypes';
import { computeDayStats, formatCurrency, getCurrentTradingDate } from './calendarUtils';
import { BarChart3, TrendingUp, TrendingDown, Target, Award, Calendar, Zap } from 'lucide-react';

interface CalendarDailyPnLBarChartProps {
  currentYear: number;
  currentMonth: number; // 0-indexed: 0 = Jan, 11 = Dec
  tradesByDay: Record<string, Trade[]>;
  onSelectDay?: (dateStr: string) => void;
  className?: string;
}

interface DayBarData {
  dayNum: number;
  dateStr: string;
  pnl: number;
  grossProfit: number;
  grossLoss: number;
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  hasTrades: boolean;
  isToday: boolean;
  dayOfWeek: number; // 0 = Sun, 1 = Mon ... 6 = Sat
  dayOfWeekName: string;
}

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export const CalendarDailyPnLBarChart: React.FC<CalendarDailyPnLBarChartProps> = ({
  currentYear,
  currentMonth,
  tradesByDay,
  onSelectDay,
  className = '',
}) => {
  const [hoveredDay, setHoveredDay] = useState<DayBarData | null>(null);

  // Compute daily stats for every day of current month (按交易日时间统计)
  const { days, totalPnL, greenDays, redDays, breakevenDays, winDayRate, bestDay, worstDay, maxAbsPnl, activeDaysCount, totalTradesCount, avgTradesPerDay } = useMemo(() => {
    const todayStr = getCurrentTradingDate();
    
    // Total days in the current month
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const dayList: DayBarData[] = [];

    let sumPnL = 0;
    let greenCount = 0;
    let redCount = 0;
    let beCount = 0;
    let best: { dateStr: string; pnl: number } | null = null;
    let worst: { dateStr: string; pnl: number } | null = null;
    let totalTrades = 0;

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTrades = tradesByDay[dateStr] || [];
      const stats = computeDayStats(dayTrades, dateStr);
      const dayDate = new Date(currentYear, currentMonth, d);
      const dow = dayDate.getDay();

      const hasTrades = stats.count > 0;
      const pnl = Math.round(stats.pnl * 100) / 100;

      if (hasTrades) {
        sumPnL += pnl;
        totalTrades += stats.count;
        if (pnl > 0) {
          greenCount++;
          if (!best || pnl > best.pnl) best = { dateStr, pnl };
        } else if (pnl < 0) {
          redCount++;
          if (!worst || pnl < worst.pnl) worst = { dateStr, pnl };
        } else {
          beCount++;
        }
      }

      dayList.push({
        dayNum: d,
        dateStr,
        pnl,
        grossProfit: stats.grossProfit,
        grossLoss: stats.grossLoss,
        count: stats.count,
        wins: stats.wins,
        losses: stats.losses,
        winRate: stats.winRate,
        hasTrades,
        isToday: dateStr === todayStr,
        dayOfWeek: dow,
        dayOfWeekName: WEEKDAY_NAMES[dow],
      });
    }

    const maxAbs = Math.max(20, ...dayList.map(item => Math.abs(item.pnl)));
    const active = greenCount + redCount + beCount;
    const dayWinPct = (greenCount + redCount) > 0 ? (greenCount / (greenCount + redCount)) * 100 : 0;
    const avgTrades = active > 0 ? Number((totalTrades / active).toFixed(1)) : 0;

    return {
      days: dayList,
      totalPnL: Math.round(sumPnL * 100) / 100,
      greenDays: greenCount,
      redDays: redCount,
      breakevenDays: beCount,
      winDayRate: dayWinPct,
      bestDay: best,
      worstDay: worst,
      maxAbsPnl: maxAbs,
      activeDaysCount: active,
      totalTradesCount: totalTrades,
      avgTradesPerDay: avgTrades,
    };
  }, [currentYear, currentMonth, tradesByDay]);

  const isNetProfit = totalPnL >= 0;

  return (
    <div className={`border-b border-gray-200 dark:border-white/10 p-4 sm:p-5 bg-gradient-to-b from-gray-50/80 to-transparent dark:from-navy-950/40 dark:to-transparent ${className}`}>
      
      {/* 1. Header Toolbar with KPIs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
        {/* Left Title */}
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 border border-purple-200/80 dark:border-purple-800/40 shadow-2xs">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              月盈亏统计
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
              {currentYear}年 {currentMonth + 1}月
            </span>
          </div>
        </div>

        {/* Right Metric Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {/* Monthly Total PnL */}
          <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-white/10 shadow-2xs flex items-center space-x-1.5">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">当月净盈亏:</span>
            <span className={`font-bold text-sm ${isNetProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {isNetProfit ? '+' : ''}${totalPnL.toFixed(2)}
            </span>
          </div>

          {/* Green vs Red Days */}
          <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-white/10 shadow-2xs flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">{greenDays}绿</span>
            </div>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              <span className="text-rose-700 dark:text-rose-400 font-bold">{redDays}红</span>
            </div>
            <span className="text-[10px] text-gray-400">
              ({winDayRate.toFixed(0)}% 胜率)
            </span>
          </div>

          {/* Total Trades & Avg Trades Per Day */}
          <div 
            data-testid="trades-count-kpi"
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-white/10 shadow-2xs flex items-center space-x-2"
            title={activeDaysCount > 0 ? `当月交易总笔数: ${totalTradesCount} 笔，在 ${activeDaysCount} 个活跃交易日中平均每天 ${avgTradesPerDay} 笔` : '当月暂无交易'}
          >
            <div className="flex items-center space-x-1">
              <span className="text-[11px] text-gray-500 dark:text-gray-400">交易总笔数:</span>
              <span className="font-bold text-sm text-gray-900 dark:text-white">{totalTradesCount}</span>
              <span className="text-[10px] text-gray-400">笔</span>
            </div>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <div className="flex items-center space-x-1">
              <span className="text-[11px] text-gray-500 dark:text-gray-400">平均每天:</span>
              <span className="font-bold text-sm text-purple-600 dark:text-purple-400">{avgTradesPerDay}</span>
              <span className="text-[10px] text-gray-400">笔</span>
            </div>
          </div>

          {/* Best Day */}
          {bestDay && (
            <div className="hidden sm:flex px-2.5 py-1.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-[11px] items-center space-x-1 text-emerald-700 dark:text-emerald-300">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span>最佳:</span>
              <span className="font-bold">+${bestDay.pnl.toFixed(0)}</span>
              <span className="text-[10px] text-emerald-600/70">({bestDay.dateStr.split('-')[2]}日)</span>
            </div>
          )}

          {/* Worst Day */}
          {worstDay && (
            <div className="hidden sm:flex px-2.5 py-1.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/40 text-[11px] items-center space-x-1 text-rose-700 dark:text-rose-300">
              <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
              <span>最大亏损:</span>
              <span className="font-bold">${worstDay.pnl.toFixed(0)}</span>
              <span className="text-[10px] text-rose-600/70">({worstDay.dateStr.split('-')[2]}日)</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Interactive Bipolar Bar Chart Canvas */}
      <div className="relative pt-2 pb-1">
        
        {/* Hover Tooltip Overlay */}
        {hoveredDay && (
          <div 
            className="absolute top-0 right-2 z-20 pointer-events-none bg-gray-900/95 dark:bg-[#070a13]/95 backdrop-blur-md text-white border border-gray-700 dark:border-white/20 rounded-xl p-2.5 shadow-xl text-xs font-mono space-y-1 animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="flex items-center justify-between space-x-3 text-[11px] text-gray-400">
              <span>{hoveredDay.dateStr} ({hoveredDay.dayOfWeekName})</span>
              {hoveredDay.isToday && (
                <span className="px-1.5 py-0.2 rounded bg-purple-600 text-white font-bold text-[9px]">
                  TODAY
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">单日净盈亏:</span>
              <span className={`font-bold text-sm ${
                hoveredDay.pnl > 0 
                  ? 'text-emerald-400' 
                  : hoveredDay.pnl < 0 
                  ? 'text-rose-400' 
                  : 'text-gray-300'
              }`}>
                {hoveredDay.pnl >= 0 ? '+' : ''}${hoveredDay.pnl.toFixed(2)}
              </span>
            </div>
            {hoveredDay.hasTrades ? (
              <div className="space-y-1 pt-1 border-t border-white/10 text-[11px]">
                <div className="text-gray-400 flex items-center justify-between">
                  <span>{hoveredDay.count} 笔订单 ({hoveredDay.wins}胜 / {hoveredDay.losses}负)</span>
                  <span className="text-gray-300 font-mono">胜率 {hoveredDay.winRate.toFixed(0)}%</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-emerald-400 font-bold">盈利: +${hoveredDay.grossProfit.toFixed(2)}</span>
                  <span className="text-rose-400 font-bold">亏损: -${hoveredDay.grossLoss.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-gray-500 italic pt-0.5 border-t border-white/10">
                当日无交易成交
              </div>
            )}
          </div>
        )}

        {/* Chart Container */}
        <div className="h-44 sm:h-48 flex flex-col justify-between select-none">
          
          {/* Top Half: Positive P&L (Grows Upwards from Bottom) */}
          <div className="flex-1 flex items-end gap-1 sm:gap-1.5 px-1 relative">
            {/* Guide line for max positive */}
            <div className="absolute top-0 left-0 right-0 border-b border-gray-100 dark:border-white/[0.04] pointer-events-none flex justify-between text-[9px] font-mono text-gray-400 px-1">
              <span>+${maxAbsPnl.toFixed(0)}</span>
            </div>

            {days.map((d) => {
              const isPos = d.pnl > 0;
              const heightPct = isPos ? Math.max(8, Math.min(95, (d.pnl / maxAbsPnl) * 100)) : 0;

              return (
                <div
                  key={`top-${d.dayNum}`}
                  onMouseEnter={() => setHoveredDay(d)}
                  onMouseLeave={() => setHoveredDay(null)}
                  onClick={() => d.hasTrades && onSelectDay && onSelectDay(d.dateStr)}
                  className={`flex-1 h-full flex flex-col justify-end items-center group relative ${
                    d.hasTrades ? 'cursor-pointer' : ''
                  }`}
                >
                  {isPos && (
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full max-w-[32px] rounded-t-md bg-gradient-to-t from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 dark:from-emerald-600 dark:to-emerald-400 shadow-xs transition-all duration-200"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Zero Axis Centerline */}
          <div className="h-[2px] bg-gray-300 dark:bg-white/20 relative w-full flex items-center justify-between">
            <span className="absolute -left-1 text-[9px] font-mono font-bold text-gray-400 dark:text-gray-500 select-none">
              $0
            </span>
            {days.map((d) => (
              <div 
                key={`axis-${d.dayNum}`} 
                className="flex-1 flex justify-center items-center"
              >
                {!d.hasTrades && (
                  <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-white/20" />
                )}
              </div>
            ))}
          </div>

          {/* Bottom Half: Negative P&L (Grows Downwards from Top) */}
          <div className="flex-1 flex items-start gap-1 sm:gap-1.5 px-1 relative">
            {/* Guide line for max negative */}
            <div className="absolute bottom-0 left-0 right-0 border-t border-gray-100 dark:border-white/[0.04] pointer-events-none flex justify-between text-[9px] font-mono text-gray-400 px-1">
              <span>-${maxAbsPnl.toFixed(0)}</span>
            </div>

            {days.map((d) => {
              const isNeg = d.pnl < 0;
              const heightPct = isNeg ? Math.max(8, Math.min(95, (Math.abs(d.pnl) / maxAbsPnl) * 100)) : 0;

              return (
                <div
                  key={`bot-${d.dayNum}`}
                  onMouseEnter={() => setHoveredDay(d)}
                  onMouseLeave={() => setHoveredDay(null)}
                  onClick={() => d.hasTrades && onSelectDay && onSelectDay(d.dateStr)}
                  className={`flex-1 h-full flex flex-col justify-start items-center group relative ${
                    d.hasTrades ? 'cursor-pointer' : ''
                  }`}
                >
                  {isNeg && (
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full max-w-[32px] rounded-b-md bg-gradient-to-b from-rose-500 to-rose-400 hover:from-rose-400 hover:to-rose-300 dark:from-rose-600 dark:to-rose-400 shadow-xs transition-all duration-200"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Day Numbers Horizontal Axis */}
          <div className="flex gap-1 sm:gap-1.5 px-1 pt-1 border-t border-gray-100 dark:border-white/5">
            {days.map((d) => {
              const isWeekend = d.dayOfWeek === 0 || d.dayOfWeek === 6;

              return (
                <div
                  key={`lbl-${d.dayNum}`}
                  onMouseEnter={() => setHoveredDay(d)}
                  onMouseLeave={() => setHoveredDay(null)}
                  onClick={() => d.hasTrades && onSelectDay && onSelectDay(d.dateStr)}
                  className={`flex-1 flex flex-col items-center justify-center text-[10px] font-mono transition-colors ${
                    d.hasTrades ? 'cursor-pointer hover:text-purple-600 dark:hover:text-purple-400' : ''
                  }`}
                >
                  {d.isToday ? (
                    <span className="w-4 h-4 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-[9px] shadow-2xs">
                      {d.dayNum}
                    </span>
                  ) : (
                    <span className={`${
                      d.hasTrades 
                        ? 'font-bold text-gray-900 dark:text-gray-100' 
                        : isWeekend 
                        ? 'text-gray-300 dark:text-gray-600' 
                        : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {d.dayNum}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </div>

    </div>
  );
};

export default CalendarDailyPnLBarChart;
