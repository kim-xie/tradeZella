import React, { useMemo, useState } from 'react';
import { Layers, ArrowUpDown, TrendingUp, TrendingDown, Award } from 'lucide-react';
import { calculateTradePnL } from '../calendar/calendarUtils';

interface SymbolPerformanceTableProps {
  trades: any[];
  className?: string;
}

export const SymbolPerformanceTable: React.FC<SymbolPerformanceTableProps> = ({ trades, className = '' }) => {
  const [sortField, setSortField] = useState<'pnl' | 'winRate' | 'tradesCount' | 'symbol'>('pnl');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const symbolStats = useMemo(() => {
    const map: Record<string, {
      symbol: string;
      tradesCount: number;
      winningTrades: number;
      losingTrades: number;
      pnl: number;
      totalWins: number;
      totalLosses: number;
      longCount: number;
      shortCount: number;
      bestTrade: number;
      worstTrade: number;
    }> = {};

    trades.forEach(t => {
      const sym = (t.symbol || 'UNKNOWN').toUpperCase();
      if (!map[sym]) {
        map[sym] = {
          symbol: sym,
          tradesCount: 0,
          winningTrades: 0,
          losingTrades: 0,
          pnl: 0,
          totalWins: 0,
          totalLosses: 0,
          longCount: 0,
          shortCount: 0,
          bestTrade: 0,
          worstTrade: 0,
        };
      }

      const profit = calculateTradePnL(t);

      const item = map[sym];
      item.tradesCount++;
      item.pnl += profit;

      if ((t.direction || 'long').toLowerCase() === 'long') {
        item.longCount++;
      } else {
        item.shortCount++;
      }

      if (profit > 0) {
        item.winningTrades++;
        item.totalWins += profit;
        if (profit > item.bestTrade) item.bestTrade = profit;
      } else if (profit < 0) {
        item.losingTrades++;
        item.totalLosses += Math.abs(profit);
        if (profit < item.worstTrade) item.worstTrade = profit;
      }
    });

    const list = Object.values(map).map(s => {
      const winRate = s.tradesCount > 0 ? (s.winningTrades / s.tradesCount) * 100 : 0;
      const profitFactor = s.totalLosses > 0 ? s.totalWins / s.totalLosses : (s.totalWins > 0 ? 99 : 0);
      const avgPnl = s.tradesCount > 0 ? s.pnl / s.tradesCount : 0;

      return {
        ...s,
        winRate: Math.round(winRate * 10) / 10,
        profitFactor: Math.round(profitFactor * 100) / 100,
        avgPnl: Math.round(avgPnl * 100) / 100,
        pnl: Math.round(s.pnl * 100) / 100,
      };
    });

    return list;
  }, [trades]);

  const maxAbsPnl = Math.max(100, ...symbolStats.map(s => Math.abs(s.pnl)));

  const sortedStats = useMemo(() => {
    return [...symbolStats].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [symbolStats, sortField, sortOrder]);

  const toggleSort = (field: 'pnl' | 'winRate' | 'tradesCount' | 'symbol') => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className={`bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-white/10 p-5 shadow-xs ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
              <Layers className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              品种与标的表现透视排行榜 (Symbol Breakdown)
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            发现最具 Alpha 的盈利资产与主要亏损漏洞品种
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-white/10 text-gray-400">
              <th 
                onClick={() => toggleSort('symbol')}
                className="py-2.5 px-3 text-left font-semibold cursor-pointer hover:text-gray-700 dark:hover:text-white"
              >
                <div className="flex items-center space-x-1">
                  <span>交易品种</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th 
                onClick={() => toggleSort('tradesCount')}
                className="py-2.5 px-3 text-center font-semibold cursor-pointer hover:text-gray-700 dark:hover:text-white"
              >
                <div className="flex items-center justify-center space-x-1">
                  <span>总交易数</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th 
                onClick={() => toggleSort('winRate')}
                className="py-2.5 px-3 text-center font-semibold cursor-pointer hover:text-gray-700 dark:hover:text-white"
              >
                <div className="flex items-center justify-center space-x-1">
                  <span>胜率 (Win%)</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 text-center font-semibold">多空比例 (L/S)</th>
              <th className="py-2.5 px-3 text-center font-semibold">盈亏比 (PF)</th>
              <th className="py-2.5 px-3 text-center font-semibold">笔均收益</th>
              <th 
                onClick={() => toggleSort('pnl')}
                className="py-2.5 px-4 text-right font-bold text-gray-700 dark:text-gray-200 cursor-pointer hover:text-purple-600"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>净利润 (P&L)</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {sortedStats.map(s => {
              const isProfit = s.pnl >= 0;
              const barWidth = Math.min(100, Math.max(5, (Math.abs(s.pnl) / maxAbsPnl) * 100));

              return (
                <tr key={s.symbol} className="hover:bg-purple-50/20 dark:hover:bg-white/[0.01] transition-colors">
                  <td className="py-3 px-3 font-bold text-gray-900 dark:text-white">
                    {s.symbol}
                  </td>
                  <td className="py-3 px-3 text-center text-gray-600 dark:text-gray-300">
                    {s.tradesCount}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded font-bold ${
                      s.winRate >= 50 
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' 
                        : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                    }`}>
                      {s.winRate}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center text-gray-500">
                    <span className="text-emerald-600">{s.longCount}</span> / <span className="text-rose-500">{s.shortCount}</span>
                  </td>
                  <td className="py-3 px-3 text-center text-gray-600 dark:text-gray-300">
                    {s.profitFactor}
                  </td>
                  <td className="py-3 px-3 text-center font-medium">
                    <span className={s.avgPnl >= 0 ? 'text-emerald-600' : 'text-rose-500'}>
                      {s.avgPnl >= 0 ? '+' : ''}${s.avgPnl}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <div className="w-16 bg-gray-100 dark:bg-white/5 h-1.5 rounded-full overflow-hidden hidden sm:block">
                        <div 
                          style={{ width: `${barWidth}%` }}
                          className={`h-full ${isProfit ? 'bg-emerald-500' : 'bg-rose-500'}`}
                        />
                      </div>
                      <span className={`font-black ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {isProfit ? '+' : ''}${s.pnl.toFixed(2)}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SymbolPerformanceTable;
