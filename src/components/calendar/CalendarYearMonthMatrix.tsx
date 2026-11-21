import React, { useMemo } from 'react';
import { Trade } from './calendarTypes';
import {
  computeDayStats,
  formatCurrency,
  getTradeEntryTime,
  getTradeTradingDate,
} from './calendarUtils';
import { Calendar, BarChart2, TrendingUp, ChevronRight } from 'lucide-react';

interface CalendarYearMonthMatrixProps {
  trades: Trade[];
  currentYear: number;
  currentMonth: number; // 0-indexed (0 = Jan, 11 = Dec)
  onSelectMonth: (year: number, month: number) => void;
  onSelectYear: (year: number) => void;
}

interface PeriodSummary {
  label: string;
  pnl: number;
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  hasData: boolean;
  isCurrent?: boolean;
}

export const CalendarYearMonthMatrix: React.FC<CalendarYearMonthMatrixProps> = ({
  trades,
  currentYear,
  currentMonth,
  onSelectMonth,
  onSelectYear,
}) => {
  // Group trades by year and month with reactive aggregation
  const { monthlyData, h1Data, h2Data, yearlyData } = useMemo(() => {
    const monthMap: Record<string, Trade[]> = {};
    const yearMap: Record<number, Trade[]> = {};
    const yearsSet = new Set<number>();

    // Collect years from actual trade data using trading day
    trades.forEach((t) => {
      const timeStr = getTradeTradingDate(t);
      if (!timeStr || timeStr.length < 7) return;
      const y = parseInt(timeStr.substring(0, 4), 10);
      const m = parseInt(timeStr.substring(5, 7), 10) - 1;
      if (isNaN(y) || isNaN(m)) return;

      yearsSet.add(y);

      const ymKey = `${y}-${String(m + 1).padStart(2, '0')}`;
      if (!monthMap[ymKey]) monthMap[ymKey] = [];
      monthMap[ymKey].push(t);

      if (!yearMap[y]) yearMap[y] = [];
      yearMap[y].push(t);
    });

    // 12 Months of currentYear
    const months: PeriodSummary[] = [];
    const h1Trades: Trade[] = [];
    const h2Trades: Trade[] = [];

    for (let m = 0; m < 12; m++) {
      const ymKey = `${currentYear}-${String(m + 1).padStart(2, '0')}`;
      const mTrades = monthMap[ymKey] || [];
      const hasData = mTrades.length > 0;
      const stats = computeDayStats(mTrades);

      months.push({
        label: `${m + 1}月`,
        pnl: stats.pnl,
        count: stats.count,
        wins: stats.wins,
        losses: stats.losses,
        winRate: stats.winRate,
        hasData,
        isCurrent: m === currentMonth,
      });

      if (m < 6) {
        h1Trades.push(...mTrades);
      } else {
        h2Trades.push(...mTrades);
      }
    }

    const h1Stats = computeDayStats(h1Trades);
    const h1: PeriodSummary = {
      label: '1-6月 [半年度]',
      pnl: h1Stats.pnl,
      count: h1Stats.count,
      wins: h1Stats.wins,
      losses: h1Stats.losses,
      winRate: h1Stats.winRate,
      hasData: h1Trades.length > 0,
    };

    const h2Stats = computeDayStats(h2Trades);
    const h2: PeriodSummary = {
      label: '7-12月 [半年度]',
      pnl: h2Stats.pnl,
      count: h2Stats.count,
      wins: h2Stats.wins,
      losses: h2Stats.losses,
      winRate: h2Stats.winRate,
      hasData: h2Trades.length > 0,
    };

    // Years breakdown sorted ascending: only include years with actual data
    const sortedYears = Array.from(yearsSet)
      .filter((y) => yearMap[y] && yearMap[y].length > 0)
      .sort((a, b) => a - b);
    const years: (PeriodSummary & { year: number; isActive: boolean })[] = sortedYears.map((y) => {
      const yTrades = yearMap[y] || [];
      const stats = computeDayStats(yTrades);
      return {
        year: y,
        label: `${y}年`,
        pnl: stats.pnl,
        count: stats.count,
        wins: stats.wins,
        losses: stats.losses,
        winRate: stats.winRate,
        hasData: yTrades.length > 0,
        isActive: y === currentYear,
      };
    });

    return {
      monthlyData: months,
      h1Data: h1,
      h2Data: h2,
      yearlyData: years,
    };
  }, [trades, currentYear, currentMonth]);

  return (
    <div className="space-y-6">
      {/* 1. Monthly Performance Breakdown Matrix */}
      <div className="space-y-3">
        {/* Section Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold text-gray-900 dark:text-white">
            <BarChart2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="font-mono tracking-wide">MONTHLY_PERFORMANCE_BREAKDOWN</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              {currentYear}年度月份复盘
            </span>
          </div>
          <span className="text-[11px] text-gray-400 font-sans hidden sm:inline">
            点击任意月份卡片可联动切换日历
          </span>
        </div>

        {/* 7-Column Grid: Row 1 = 1-6月 + H1; Row 2 = 7-12月 + H2 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {/* Row 1: Months 1 to 6 */}
          {monthlyData.slice(0, 6).map((m, idx) => (
            <MonthCard
              key={idx}
              data={m}
              onClick={() => onSelectMonth(currentYear, idx)}
            />
          ))}

          {/* Row 1, Column 7: H1 Half-year */}
          <HalfYearCard
            data={h1Data}
            onClick={() => onSelectMonth(currentYear, 0)}
          />

          {/* Row 2: Months 7 to 12 */}
          {monthlyData.slice(6, 12).map((m, idx) => (
            <MonthCard
              key={idx + 6}
              data={m}
              onClick={() => onSelectMonth(currentYear, idx + 6)}
            />
          ))}

          {/* Row 2, Column 7: H2 Half-year */}
          <HalfYearCard
            data={h2Data}
            onClick={() => onSelectMonth(currentYear, 6)}
          />
        </div>
      </div>

      {/* 2. Yearly Archive Data Matrix */}
      <div className="space-y-3 pt-2 border-t border-gray-200/80 dark:border-white/10">
        {/* Section Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold text-gray-900 dark:text-white">
            <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="font-mono tracking-wide">YEARLY_ARCHIVE_DATA</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              年度历史总览
            </span>
          </div>
          <span className="text-[11px] text-gray-400 font-sans hidden sm:inline">
            点击年份卡片可联动切换年度数据
          </span>
        </div>

        {/* Yearly Grid */}
        {yearlyData.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-gray-200 dark:border-white/10 text-center text-xs text-gray-400 font-mono">
            暂无历史年度交易数据
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {yearlyData.map((y) => (
              <div
                key={y.year}
                onClick={() => onSelectYear(y.year)}
                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all duration-150 hover:scale-[1.02] flex flex-col justify-between min-h-[85px] ${
                  y.isActive
                    ? 'border-purple-500 dark:border-purple-400 bg-purple-50/70 dark:bg-purple-950/40 ring-2 ring-purple-500/20 shadow-md'
                    : 'bg-white dark:bg-[#111827] border-gray-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-600/50'
                }`}
                title={`点击切换至 ${y.label} 绩效`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-mono font-bold text-xs ${y.isActive ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-white'}`}>
                    {y.label}
                  </span>
                  {y.isActive && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-purple-600 text-white shadow-2xs">
                      ACTIVE
                    </span>
                  )}
                </div>

                <div className="my-auto py-1">
                  <div
                    className={`font-black font-mono tracking-tight text-sm ${
                      y.pnl >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatCurrency(y.pnl)}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                    {y.count}单 | 胜{y.winRate.toFixed(0)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Sub-component: Month Card (Unified Theme)
const MonthCard: React.FC<{ data: PeriodSummary; onClick: () => void }> = ({
  data,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all duration-150 hover:scale-[1.02] flex flex-col justify-between min-h-[85px] ${
        data.isCurrent
          ? 'border-purple-500 dark:border-purple-400 bg-purple-50/70 dark:bg-purple-950/40 ring-2 ring-purple-500/20 shadow-md'
          : data.hasData
          ? data.pnl >= 0
            ? 'bg-emerald-50/30 dark:bg-emerald-950/15 border-emerald-200/80 dark:border-emerald-800/40 hover:border-emerald-400'
            : 'bg-rose-50/30 dark:bg-rose-950/15 border-rose-200/80 dark:border-rose-800/40 hover:border-rose-400'
          : 'bg-white dark:bg-[#111827] border-gray-200/80 dark:border-white/10 opacity-70 hover:opacity-100 hover:border-purple-300'
      }`}
      title={`点击切换至 ${data.label} 日历`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={`font-mono font-bold text-xs ${data.isCurrent ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-white'}`}>
          {data.label}
        </span>
        {data.isCurrent && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-purple-600 text-white shadow-2xs">
            CURRENT
          </span>
        )}
      </div>

      {data.hasData ? (
        <div className="my-auto py-1">
          <div
            className={`font-black font-mono tracking-tight text-sm ${
              data.pnl >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatCurrency(data.pnl)}
          </div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
            {data.count}单 | 胜{data.winRate.toFixed(0)}%
          </div>
        </div>
      ) : (
        <div className="my-auto text-[10px] font-mono text-gray-400 dark:text-gray-500">
          NO_DATA
        </div>
      )}
    </div>
  );
};

// Sub-component: Half-Year Card (Unified Theme)
const HalfYearCard: React.FC<{ data: PeriodSummary; onClick: () => void }> = ({ data, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all duration-150 hover:scale-[1.02] flex flex-col justify-between min-h-[85px] ${
        data.hasData
          ? data.pnl >= 0
            ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/40 hover:border-purple-400'
            : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40 hover:border-rose-400'
          : 'bg-gray-50/70 dark:bg-navy-950/30 border-gray-200/80 dark:border-white/5 opacity-60 hover:opacity-100'
      }`}
      title={`点击切换至该半年度`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono font-bold text-gray-800 dark:text-gray-200 text-xs">
          {data.label}
        </span>
        <ChevronRight className="w-3 h-3 text-gray-400" />
      </div>

      {data.hasData ? (
        <div className="my-auto py-1">
          <div
            className={`font-black font-mono tracking-tight text-sm ${
              data.pnl >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatCurrency(data.pnl)}
          </div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
            {data.count}单 | 胜{data.winRate.toFixed(0)}%
          </div>
        </div>
      ) : (
        <div className="my-auto text-[10px] font-mono text-gray-400 dark:text-gray-500">
          NO_DATA
        </div>
      )}
    </div>
  );
};
