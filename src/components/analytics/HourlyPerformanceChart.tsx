import React, { useMemo, useState } from 'react';
import { Clock, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { calculateTradePnL } from '../calendar/calendarUtils';

interface HourlyPerformanceChartProps {
  trades: any[];
  className?: string;
}

export const HourlyPerformanceChart: React.FC<HourlyPerformanceChartProps> = ({ trades, className = '' }) => {
  const [metric, setMetric] = useState<'pnl' | 'winRate'>('pnl');

  const hourlyStats = useMemo(() => {
    // 24 hours (0-23)
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${String(i).padStart(2, '0')}:00`,
      tradesCount: 0,
      winningTrades: 0,
      pnl: 0,
      winRate: 0,
    }));

    trades.forEach(t => {
      const timeStr = t.entry_time || t.createdat || t.trade_date;
      if (!timeStr) return;

      const dateObj = new Date(timeStr);
      if (isNaN(dateObj.getTime())) return;

      const hour = dateObj.getHours();
      if (hour >= 0 && hour < 24) {
        const profit = calculateTradePnL(t);
        hours[hour].tradesCount++;
        hours[hour].pnl += profit;
        if (profit > 0.001) hours[hour].winningTrades++;
      }
    });

    hours.forEach(h => {
      h.winRate = h.tradesCount > 0 ? (h.winningTrades / h.tradesCount) * 100 : 0;
      h.pnl = Math.round(h.pnl * 100) / 100;
    });

    return hours;
  }, [trades]);

  const maxPnl = Math.max(10, ...hourlyStats.map(h => Math.abs(h.pnl)));

  return (
    <div className={`bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-white/10 p-5 shadow-xs ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
              <Clock className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              交易时段表现分布 (Hourly Performance)
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            发现你的黄金交易时段（亚洲盘 / 伦敦盘 / 纽约盘）
          </p>
        </div>

        <div className="flex items-center p-1 bg-gray-100 dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-white/10 text-xs">
          <button
            type="button"
            onClick={() => setMetric('pnl')}
            className={`px-3 py-1 rounded-lg font-mono font-bold transition-all ${
              metric === 'pnl'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            净利润 (P&L)
          </button>
          <button
            type="button"
            onClick={() => setMetric('winRate')}
            className={`px-3 py-1 rounded-lg font-mono font-bold transition-all ${
              metric === 'winRate'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            胜率 (Win Rate)
          </button>
        </div>
      </div>

      {/* Bar Chart Visualization */}
      <div className="h-48 flex items-end gap-1.5 pt-6 pb-2 px-1 overflow-x-auto">
        {hourlyStats.map(h => {
          const hasTrades = h.tradesCount > 0;
          let barHeight = 0;
          let barColor = 'bg-gray-200 dark:bg-gray-800';

          if (hasTrades) {
            if (metric === 'pnl') {
              const absRatio = Math.min(1, Math.abs(h.pnl) / maxPnl);
              barHeight = Math.max(8, absRatio * 100);
              barColor = h.pnl >= 0 ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-rose-500 hover:bg-rose-400';
            } else {
              barHeight = Math.max(8, h.winRate);
              barColor = h.winRate >= 50 ? 'bg-purple-600 hover:bg-purple-500' : 'bg-amber-500 hover:bg-amber-400';
            }
          }

          return (
            <div key={h.hour} className="flex-1 flex flex-col items-center min-w-[20px] group relative h-full justify-end">
              {/* Tooltip */}
              <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] font-mono px-2 py-1 rounded shadow-lg pointer-events-none z-30 whitespace-nowrap">
                <div>{h.label} ({h.tradesCount} 笔)</div>
                <div>{metric === 'pnl' ? `P&L: $${h.pnl}` : `胜率: ${h.winRate.toFixed(1)}%`}</div>
              </div>

              {/* Bar */}
              <div
                style={{ height: `${hasTrades ? barHeight : 4}%` }}
                className={`w-full rounded-t-sm transition-all duration-300 ${barColor}`}
              />

              {/* Hour Label */}
              <span className="text-[9px] font-mono text-gray-400 mt-1 select-none">
                {h.hour % 3 === 0 ? `${h.hour}h` : ''}
              </span>
            </div>
          );
        })}
      </div>

      {/* Market Session Reference Footnote */}
      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-white/5 flex flex-wrap items-center justify-between text-[11px] font-mono text-gray-400">
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            <span>亚洲盘 (00:00 - 08:00)</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            <span>伦敦盘 (07:00 - 16:00)</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            <span>纽约盘 (13:00 - 21:00)</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default HourlyPerformanceChart;
