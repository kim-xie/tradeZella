import React, { useMemo } from 'react';
import { Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { getTradeDayOfWeek, calculateTradePnL } from '../calendar/calendarUtils';

interface DayOfWeekChartProps {
  trades: any[];
  className?: string;
}

const WEEKDAYS = [
  { day: 1, name: '周一 (Mon)' },
  { day: 2, name: '周二 (Tue)' },
  { day: 3, name: '周三 (Wed)' },
  { day: 4, name: '周四 (Thu)' },
  { day: 5, name: '周五 (Fri)' },
];

export const DayOfWeekChart: React.FC<DayOfWeekChartProps> = ({ trades, className = '' }) => {
  const dayStats = useMemo(() => {
    const map = WEEKDAYS.map(w => ({
      ...w,
      count: 0,
      wins: 0,
      pnl: 0,
      winRate: 0,
    }));

    trades.forEach(t => {
      const dayIdx = getTradeDayOfWeek(t);
      if (dayIdx < 0) return;

      // 国际金融市场标准交易日（周一至周五）。
      // 若出现周日夜盘开盘（dayIdx 0），归入周一交易日；若出现极少数周六白天订单，归入周五交易日。
      let targetDay = dayIdx;
      if (targetDay === 0) targetDay = 1;
      if (targetDay === 6) targetDay = 5;

      const target = map.find(m => m.day === targetDay);
      if (target) {
        const profit = calculateTradePnL(t);
        target.count++;
        target.pnl += profit;
        if (profit > 0.001) target.wins++;
      }
    });

    map.forEach(m => {
      m.winRate = m.count > 0 ? (m.wins / m.count) * 100 : 0;
      m.pnl = Math.round(m.pnl * 100) / 100;
    });

    return map;
  }, [trades]);

  const maxAbsPnl = Math.max(10, ...dayStats.map(d => Math.abs(d.pnl)));

  return (
    <div className={`bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-white/10 p-5 shadow-xs ${className}`}>
      <div className="flex items-center space-x-2 mb-4">
        <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
          <Calendar className="w-4 h-4" />
        </span>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
          星期胜率与盈亏分布 (Day of Week)
        </h3>
      </div>

      <div className="space-y-3">
        {dayStats.map(d => {
          const isPositive = d.pnl >= 0;
          const ratio = Math.min(100, Math.max(10, (Math.abs(d.pnl) / maxAbsPnl) * 100));

          return (
            <div key={d.day} className="space-y-1">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {d.name} <span className="text-[10px] text-gray-400">({d.count}笔)</span>
                </span>
                <div className="flex items-center space-x-3">
                  <span className="text-gray-500">胜率: {d.winRate.toFixed(1)}%</span>
                  <span className={`font-bold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {isPositive ? '+' : ''}${d.pnl.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-100 dark:bg-white/5 h-2 rounded-full overflow-hidden">
                <div
                  style={{ width: `${d.count > 0 ? ratio : 0}%` }}
                  className={`h-full rounded-full transition-all duration-300 ${
                    isPositive ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DayOfWeekChart;
