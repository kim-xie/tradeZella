import React, { useMemo, useState } from 'react';
import { Calendar, DollarSign, Percent, TrendingUp, Award } from 'lucide-react';
import { getTradeMonthAndYear, calculateTradePnL } from '../calendar/calendarUtils';

interface MonthlyReturnsMatrixProps {
  trades: any[];
  className?: string;
  initialCapital?: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const MonthlyReturnsMatrix: React.FC<MonthlyReturnsMatrixProps> = ({
  trades,
  className = '',
  initialCapital = 10000,
}) => {
  const [displayMode, setDisplayMode] = useState<'pnl' | 'percent'>('pnl');

  // Compute monthly matrix data
  const matrixData = useMemo(() => {
    // Map of year -> array of 12 months
    const yearMap: Record<number, {
      year: number;
      months: Array<{
        pnl: number;
        percent: number;
        count: number;
        wins: number;
      }>;
      totalPnl: number;
      totalPercent: number;
      totalCount: number;
    }> = {};

    trades.forEach(t => {
      const { year, month } = getTradeMonthAndYear(t);

      if (!yearMap[year]) {
        yearMap[year] = {
          year,
          months: Array.from({ length: 12 }, () => ({
            pnl: 0,
            percent: 0,
            count: 0,
            wins: 0,
          })),
          totalPnl: 0,
          totalPercent: 0,
          totalCount: 0,
        };
      }

      const profit = calculateTradePnL(t);

      yearMap[year].months[month].pnl += profit;
      yearMap[year].months[month].count++;
      if (profit > 0.001) yearMap[year].months[month].wins++;

      yearMap[year].totalPnl += profit;
      yearMap[year].totalCount++;
    });

    // Calculate percentages
    Object.values(yearMap).forEach(y => {
      y.months.forEach(m => {
        m.percent = (m.pnl / initialCapital) * 100;
        m.pnl = Math.round(m.pnl * 100) / 100;
        m.percent = Math.round(m.percent * 10) / 10;
      });
      y.totalPercent = Math.round(((y.totalPnl / initialCapital) * 100) * 10) / 10;
      y.totalPnl = Math.round(y.totalPnl * 100) / 100;
    });

    // Sort descending by year
    const sortedYears = Object.values(yearMap).sort((a, b) => b.year - a.year);

    // If empty, generate current year placeholder
    if (sortedYears.length === 0) {
      const currYear = new Date().getFullYear();
      sortedYears.push({
        year: currYear,
        months: Array.from({ length: 12 }, () => ({ pnl: 0, percent: 0, count: 0, wins: 0 })),
        totalPnl: 0,
        totalPercent: 0,
        totalCount: 0,
      });
    }

    // Global performance stats
    const allMonthsWithTrades = sortedYears.flatMap(y => y.months.filter(m => m.count > 0));
    const profitableMonths = allMonthsWithTrades.filter(m => m.pnl > 0).length;
    const winMonthRate = allMonthsWithTrades.length > 0
      ? (profitableMonths / allMonthsWithTrades.length) * 100
      : 0;

    const allPnlValues = allMonthsWithTrades.map(m => m.pnl);
    const bestMonth = allPnlValues.length > 0 ? Math.max(...allPnlValues) : 0;
    const worstMonth = allPnlValues.length > 0 ? Math.min(...allPnlValues) : 0;

    return {
      years: sortedYears,
      winMonthRate: Math.round(winMonthRate * 10) / 10,
      bestMonth: Math.round(bestMonth * 100) / 100,
      worstMonth: Math.round(worstMonth * 100) / 100,
    };
  }, [trades, initialCapital]);

  // Color helper for heatmap cells
  const getCellBg = (pnl: number, count: number) => {
    if (count === 0 || pnl === 0) return 'bg-gray-50/40 dark:bg-white/[0.02] text-gray-400';
    if (pnl > 0) {
      if (pnl > 1000) return 'bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-bold';
      if (pnl > 300) return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold';
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    } else {
      if (pnl < -1000) return 'bg-rose-500/25 text-rose-700 dark:text-rose-300 font-bold';
      if (pnl < -300) return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold';
      return 'bg-rose-500/10 text-rose-600 dark:text-rose-400';
    }
  };

  return (
    <div className={`bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-white/10 p-5 shadow-xs ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
              <Calendar className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              年度与月度收益矩阵 (Monthly Returns Heatmap)
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 font-semibold">
              WALL ST TEARSHEET
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            华尔街对冲基金标准的月度收益对比热力图，宏观评估跨周期盈利稳定性
          </p>
        </div>

        {/* Toggle P&L vs Percent */}
        <div className="flex items-center p-1 bg-gray-100 dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-white/10 text-xs">
          <button
            type="button"
            onClick={() => setDisplayMode('pnl')}
            className={`px-3 py-1 rounded-lg font-mono font-bold transition-all ${
              displayMode === 'pnl'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            金额 ($)
          </button>
          <button
            type="button"
            onClick={() => setDisplayMode('percent')}
            className={`px-3 py-1 rounded-lg font-mono font-bold transition-all ${
              displayMode === 'percent'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            回报率 (%)
          </button>
        </div>
      </div>

      {/* Table Matrix */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-white/10 text-gray-400">
              <th className="py-2.5 px-3 text-left font-semibold">年份</th>
              {MONTH_NAMES.map(m => (
                <th key={m} className="py-2.5 px-2 text-center font-semibold">{m}</th>
              ))}
              <th className="py-2.5 px-3 text-right font-bold text-gray-700 dark:text-gray-200">年度总回报</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {matrixData.years.map(y => (
              <tr key={y.year} className="hover:bg-purple-50/20 dark:hover:bg-white/[0.01]">
                <td className="py-3 px-3 font-black text-gray-900 dark:text-white">
                  {y.year}
                </td>
                {y.months.map((m, idx) => (
                  <td
                    key={idx}
                    className={`py-2 px-1 text-center rounded-sm transition-colors ${getCellBg(m.pnl, m.count)}`}
                    title={`${y.year}年 ${idx + 1}月: $${m.pnl} (${m.percent}%) | ${m.count}笔交易`}
                  >
                    {m.count > 0 ? (
                      <div>
                        {displayMode === 'pnl' ? (
                          <span>{m.pnl >= 0 ? '+' : ''}${Math.round(m.pnl)}</span>
                        ) : (
                          <span>{m.percent >= 0 ? '+' : ''}{m.percent}%</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600">-</span>
                    )}
                  </td>
                ))}
                <td className="py-3 px-3 text-right font-black">
                  <span className={`px-2 py-1 rounded-md ${
                    y.totalPnl >= 0 
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                  }`}>
                    {displayMode === 'pnl' ? (
                      `${y.totalPnl >= 0 ? '+' : ''}$${y.totalPnl.toFixed(0)}`
                    ) : (
                      `${y.totalPercent >= 0 ? '+' : ''}${y.totalPercent}%`
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary KPI Strip */}
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs font-mono">
        <div className="p-2.5 rounded-xl bg-gray-50/60 dark:bg-white/[0.02]">
          <span className="text-gray-400 text-[10px] block">月度盈利胜率 (Profitable Months)</span>
          <span className="font-bold text-gray-900 dark:text-white text-sm">
            {matrixData.winMonthRate}%
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-gray-50/60 dark:bg-white/[0.02]">
          <span className="text-gray-400 text-[10px] block">历史最佳月份 (Best Month)</span>
          <span className="font-bold text-emerald-500 text-sm">
            +${matrixData.bestMonth.toFixed(2)}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-gray-50/60 dark:bg-white/[0.02]">
          <span className="text-gray-400 text-[10px] block">历史最大单月回撤 (Worst Month)</span>
          <span className="font-bold text-rose-500 text-sm">
            -${Math.abs(matrixData.worstMonth).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MonthlyReturnsMatrix;
