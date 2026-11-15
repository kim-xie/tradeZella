import React, { useMemo } from 'react';
import { Target, TrendingUp, BarChart2 } from 'lucide-react';

interface RMultipleDistributionChartProps {
  trades: any[];
  className?: string;
}

const R_BUCKETS = [
  { id: 'under_neg2', label: '< -2R', min: -Infinity, max: -2.0, color: 'bg-rose-700' },
  { id: 'neg2_to_neg1', label: '-2R ~ -1R', min: -2.0, max: -1.0, color: 'bg-rose-500' },
  { id: 'neg1_to_0', label: '-1R ~ 0R', min: -1.0, max: -0.01, color: 'bg-rose-400' },
  { id: 'be', label: '0R (BE)', min: -0.01, max: 0.1, color: 'bg-gray-400' },
  { id: '0_to_1', label: '0R ~ 1R', min: 0.1, max: 1.0, color: 'bg-emerald-400' },
  { id: '1_to_2', label: '1R ~ 2R', min: 1.0, max: 2.0, color: 'bg-emerald-500' },
  { id: '2_to_3', label: '2R ~ 3R', min: 2.0, max: 3.0, color: 'bg-emerald-600' },
  { id: 'above_3', label: '3R+', min: 3.0, max: Infinity, color: 'bg-emerald-700' },
];

export const RMultipleDistributionChart: React.FC<RMultipleDistributionChartProps> = ({ trades, className = '' }) => {
  const rStats = useMemo(() => {
    const rValues: number[] = [];

    trades.forEach(t => {
      const entry = Number(t.entryprice || t.entryPrice || 0);
      const exit = Number(t.exitprice || t.exitPrice || 0);
      const sl = Number(t.stop_loss || 0);
      const size = Number(t.size || 1);

      if (!entry || !exit) return;

      let profit = 0;
      if (t.manual_pnl !== undefined && t.manual_pnl !== null) {
        profit = Number(t.manual_pnl);
      } else {
        const isLong = (t.direction || 'long').toLowerCase() === 'long';
        profit = isLong ? (exit - entry) * size : (entry - exit) * size;
      }

      let r = 0;
      if (sl > 0 && Math.abs(entry - sl) > 0) {
        const risk = Math.abs(entry - sl) * size;
        r = profit / risk;
      } else {
        // Fallback estimate if SL not explicitly specified
        r = profit > 0 ? Math.min(5, Math.max(0.5, profit / 100)) : -1.0;
      }

      rValues.push(r);
    });

    // Populate buckets
    const bucketCounts: Record<string, { count: number; label: string; color: string }> = {};
    R_BUCKETS.forEach(b => {
      bucketCounts[b.id] = { count: 0, label: b.label, color: b.color };
    });

    rValues.forEach(r => {
      const b = R_BUCKETS.find(bucket => r >= bucket.min && r < bucket.max) || R_BUCKETS[R_BUCKETS.length - 1];
      if (bucketCounts[b.id]) {
        bucketCounts[b.id].count++;
      }
    });

    const maxCount = Math.max(1, ...Object.values(bucketCounts).map(b => b.count));
    const avgR = rValues.length > 0 ? rValues.reduce((a, b) => a + b, 0) / rValues.length : 0;
    const maxWinR = rValues.length > 0 ? Math.max(...rValues) : 0;
    const maxLossR = rValues.length > 0 ? Math.min(...rValues) : 0;

    return {
      bucketCounts,
      maxCount,
      totalTrades: rValues.length,
      avgR: Math.round(avgR * 100) / 100,
      maxWinR: Math.round(maxWinR * 10) / 10,
      maxLossR: Math.round(maxLossR * 10) / 10,
    };
  }, [trades]);

  return (
    <div className={`bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-white/10 p-5 shadow-xs ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60">
              <Target className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              风险报酬 R 倍数分布直方图 (R-Multiple Distribution)
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60 font-semibold">
              PROP FIRM METRIC
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            衡量策略数学期望值 — 是否做到了严控 -1R 止损，同时让 +2R/+3R 利润充分奔跑
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <div className="text-right">
            <span className="text-gray-400 text-[10px] block">单笔数学期望 (Expectancy)</span>
            <span className={`font-bold ${rStats.avgR >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {rStats.avgR >= 0 ? '+' : ''}{rStats.avgR} R / 笔
            </span>
          </div>
        </div>
      </div>

      {/* Histogram bars */}
      <div className="h-44 flex items-end gap-2 pt-6 pb-2 px-1">
        {R_BUCKETS.map(b => {
          const item = rStats.bucketCounts[b.id] || { count: 0, label: b.label, color: b.color };
          const heightRatio = rStats.maxCount > 0 ? (item.count / rStats.maxCount) * 100 : 0;
          const pctOfTotal = rStats.totalTrades > 0 ? ((item.count / rStats.totalTrades) * 100).toFixed(0) : '0';

          return (
            <div key={b.id} className="flex-1 flex flex-col items-center h-full justify-end group relative">
              {/* Tooltip */}
              <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] font-mono px-2 py-1 rounded shadow-lg pointer-events-none z-20 whitespace-nowrap">
                <div>{item.label}</div>
                <div>{item.count} 笔 ({pctOfTotal}%)</div>
              </div>

              {/* Count label above bar */}
              {item.count > 0 && (
                <span className="text-[10px] font-mono font-bold text-gray-700 dark:text-gray-300 mb-1">
                  {item.count}
                </span>
              )}

              {/* Bar */}
              <div
                style={{ height: `${Math.max(4, heightRatio)}%` }}
                className={`w-full rounded-t-md transition-all duration-300 ${item.color} ${item.count > 0 ? 'opacity-90 hover:opacity-100' : 'opacity-20'}`}
              />

              {/* X label */}
              <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 mt-2 text-center whitespace-nowrap">
                {b.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer Metrics */}
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5 grid grid-cols-3 gap-2 text-center text-xs font-mono">
        <div>
          <span className="text-gray-400 text-[10px] block">单笔最大盈利</span>
          <span className="font-bold text-emerald-500 text-sm">+{rStats.maxWinR} R</span>
        </div>
        <div>
          <span className="text-gray-400 text-[10px] block">单笔最大亏损</span>
          <span className="font-bold text-rose-500 text-sm">{rStats.maxLossR} R</span>
        </div>
        <div>
          <span className="text-gray-400 text-[10px] block">期望盈亏不对称性</span>
          <span className="font-bold text-purple-600 dark:text-purple-400 text-sm">
            {rStats.maxLossR !== 0 ? Math.abs(rStats.maxWinR / rStats.maxLossR).toFixed(1) : 0} : 1
          </span>
        </div>
      </div>
    </div>
  );
};

export default RMultipleDistributionChart;
