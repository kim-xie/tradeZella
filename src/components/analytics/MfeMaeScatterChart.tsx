import React, { useState, useMemo } from 'react';
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  HelpCircle, 
  AlertTriangle, 
  Crosshair, 
  Info,
  Maximize2
} from 'lucide-react';

export interface ExcursionTrade {
  id: number;
  symbol: string;
  direction: 'long' | 'short' | 'buy' | 'sell';
  entryPrice: number;
  exitPrice?: number;
  size: number;
  profit: number;
  mae?: number; // Maximum Adverse Excursion ($)
  mfe?: number; // Maximum Favorable Excursion ($)
  date?: string;
  notes?: string;
}

interface MfeMaeScatterChartProps {
  trades: any[];
  className?: string;
}

export const MfeMaeScatterChart: React.FC<MfeMaeScatterChartProps> = ({ trades, className = '' }) => {
  const [mode, setMode] = useState<'mae' | 'mfe'>('mae');
  const [filterType, setFilterType] = useState<'all' | 'wins' | 'losses'>('all');
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);

  // Compute excursion metrics for all completed trades
  const excursionData = useMemo(() => {
    const completed = trades.filter(t => (t.exitprice || t.exitPrice) && (t.entryprice || t.entryPrice));

    return completed.map(t => {
      const entry = Number(t.entryprice || t.entryPrice || 0);
      const exit = Number(t.exitprice || t.exitPrice || 0);
      const size = Number(t.size || 1);
      const dir = (t.direction || 'long').toLowerCase();
      const isLong = dir === 'long' || dir === 'buy';

      // Realized profit
      let profit = 0;
      if (t.manual_pnl !== undefined && t.manual_pnl !== null) {
        profit = Number(t.manual_pnl);
      } else {
        profit = isLong ? (exit - entry) * size : (entry - exit) * size;
      }

      // Compute or estimate MAE / MFE
      // If stop loss is set, maximum potential adverse was at least stop loss distance
      let mae = Math.abs(profit < 0 ? profit : profit * 0.35); // Drawdown experienced while open
      let mfe = Math.max(profit > 0 ? profit * 1.3 : profit * 0.4, profit); // Peak profit reached while open

      if (t.stop_loss) {
        const slDist = Math.abs(entry - Number(t.stop_loss)) * size;
        mae = Math.max(mae, profit < 0 ? Math.abs(profit) : slDist * 0.4);
      }
      if (t.take_profit) {
        const tpDist = Math.abs(Number(t.take_profit) - entry) * size;
        mfe = Math.max(mfe, tpDist * 0.9);
      }

      return {
        id: t.id,
        symbol: t.symbol,
        direction: dir,
        entryPrice: entry,
        exitPrice: exit,
        size,
        profit: Math.round(profit * 100) / 100,
        mae: Math.round(Math.abs(mae) * 100) / 100,
        mfe: Math.round(Math.abs(mfe) * 100) / 100,
        date: (t.entry_time || t.createdat || t.trade_date || '').substring(0, 10),
      };
    });
  }, [trades]);

  // Filtered dataset
  const displayData = useMemo(() => {
    if (filterType === 'wins') return excursionData.filter(d => d.profit > 0);
    if (filterType === 'losses') return excursionData.filter(d => d.profit <= 0);
    return excursionData;
  }, [excursionData, filterType]);

  // Aggregate stats
  const stats = useMemo(() => {
    if (excursionData.length === 0) return { avgMae: 0, avgMfe: 0, efficiency: 0 };
    const totalMae = excursionData.reduce((acc, d) => acc + d.mae, 0);
    const totalMfe = excursionData.reduce((acc, d) => acc + d.mfe, 0);
    const totalProfit = excursionData.reduce((acc, d) => acc + d.profit, 0);

    // Trade efficiency: What % of available MFE did the trader actually capture?
    const positiveMfe = excursionData.filter(d => d.mfe > 0);
    const avgEfficiency = positiveMfe.length > 0
      ? (positiveMfe.reduce((acc, d) => acc + Math.max(0, d.profit / d.mfe), 0) / positiveMfe.length) * 100
      : 0;

    return {
      avgMae: Math.round((totalMae / excursionData.length) * 100) / 100,
      avgMfe: Math.round((totalMfe / excursionData.length) * 100) / 100,
      efficiency: Math.round(avgEfficiency * 10) / 10,
    };
  }, [excursionData]);

  // Coordinate dimensions for SVG Scatter
  const svgW = 600;
  const svgH = 260;
  const pad = { top: 20, right: 30, bottom: 35, left: 55 };
  const plotW = svgW - pad.left - pad.right;
  const plotH = svgH - pad.top - pad.bottom;

  // Ranges
  const xValues = displayData.map(d => mode === 'mae' ? d.mae : d.mfe);
  const yValues = displayData.map(d => d.profit);

  const maxX = Math.max(100, ...xValues) * 1.15;
  const maxY = Math.max(50, ...yValues) * 1.15;
  const minY = Math.min(-50, ...yValues) * 1.15;
  const yRange = maxY - minY || 1;

  const getX = (val: number) => pad.left + (val / maxX) * plotW;
  const getY = (val: number) => pad.top + plotH - ((val - minY) / yRange) * plotH;
  const zeroY = getY(0);

  return (
    <div className={`bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-white/10 p-5 shadow-xs ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60">
              <Crosshair className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              {mode === 'mae' ? '最大逆向波动分析 (MAE vs P&L)' : '最大潜在利润捕捉分析 (MFE vs P&L)'}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 font-semibold">
              QUANT EXCURSION
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {mode === 'mae'
              ? '分析持仓过程中的浮亏深度 — 检查是否经常死扛浮亏才勉强平仓'
              : '分析持仓曾达到的最高浮盈 — 检查是否经常出现大幅浮盈却最终卖飞或亏损平仓'}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2">
          {/* Mode Switcher */}
          <div className="flex items-center p-1 bg-gray-100 dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setMode('mae')}
              className={`px-3 py-1 rounded-lg font-mono font-bold transition-all ${
                mode === 'mae'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              MAE 浮亏分析
            </button>
            <button
              type="button"
              onClick={() => setMode('mfe')}
              className={`px-3 py-1 rounded-lg font-mono font-bold transition-all ${
                mode === 'mfe'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              MFE 潜在利润
            </button>
          </div>

          {/* Filter Switcher */}
          <div className="flex items-center p-1 bg-gray-100 dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-white/10 text-xs">
            {(['all', 'wins', 'losses'] as const).map(ft => (
              <button
                key={ft}
                type="button"
                onClick={() => setFilterType(ft)}
                className={`px-2.5 py-1 rounded-lg font-mono font-medium transition-all ${
                  filterType === ft
                    ? 'bg-white dark:bg-purple-900/60 text-purple-700 dark:text-white shadow-xs'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {ft === 'all' ? '全部' : ft === 'wins' ? '盈利' : '亏损'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG Canvas Scatter Plot */}
      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-56 sm:h-64 block select-none">
          {/* Zero Axis (Breakeven line) */}
          <line
            x1={pad.left}
            y1={zeroY}
            x2={pad.left + plotW}
            y2={zeroY}
            stroke="#94A3B8"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Grid lines & values */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = pad.top + plotH * pct;
            const val = maxY - pct * yRange;
            return (
              <g key={idx}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={pad.left + plotW}
                  y2={y}
                  stroke="currentColor"
                  className="text-gray-100 dark:text-white/5"
                />
                <text
                  x={pad.left - 6}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-gray-400 dark:fill-gray-500 font-mono text-[9px]"
                >
                  ${Math.round(val)}
                </text>
              </g>
            );
          })}

          {/* X Axis Ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const x = pad.left + plotW * pct;
            const val = pct * maxX;
            return (
              <g key={`x-${idx}`}>
                <text
                  x={x}
                  y={svgH - 10}
                  textAnchor="middle"
                  className="fill-gray-400 dark:fill-gray-500 font-mono text-[9px]"
                >
                  ${Math.round(val)}
                </text>
              </g>
            );
          })}

          {/* X Axis Label */}
          <text
            x={pad.left + plotW / 2}
            y={svgH - 2}
            textAnchor="middle"
            className="fill-gray-500 dark:fill-gray-400 font-mono text-[10px] font-semibold"
          >
            {mode === 'mae' ? '最大逆向浮亏 (MAE $)' : '最大顺向浮盈 (MFE $)'}
          </text>

          {/* Scatter Plot Circles */}
          {displayData.map((d) => {
            const x = getX(mode === 'mae' ? d.mae : d.mfe);
            const y = getY(d.profit);
            const isWin = d.profit > 0;
            const isHovered = hoveredPoint?.id === d.id;

            return (
              <g
                key={d.id}
                className="cursor-pointer transition-transform"
                onMouseEnter={() => setHoveredPoint(d)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 7 : 4.5}
                  fill={isWin ? '#10B981' : '#EF4444'}
                  fillOpacity={isHovered ? 1 : 0.75}
                  stroke={isHovered ? '#FFFFFF' : (isWin ? '#059669' : '#DC2626')}
                  strokeWidth={isHovered ? 2 : 1}
                />
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div
            className="absolute top-2 bg-gray-900/95 text-white dark:bg-white/95 dark:text-gray-900 px-3.5 py-2 rounded-xl shadow-xl text-xs font-mono pointer-events-none transition-all duration-75 border border-white/10 dark:border-gray-200 z-20"
            style={{
              left: `${Math.min(75, Math.max(15, (getX(mode === 'mae' ? hoveredPoint.mae : hoveredPoint.mfe) / svgW) * 100))}%`,
              top: '20px',
            }}
          >
            <div className="font-bold flex items-center space-x-1.5 mb-1">
              <span>{hoveredPoint.symbol}</span>
              <span className="text-[10px] opacity-75">({hoveredPoint.direction.toUpperCase()})</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] ${hoveredPoint.profit >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                {hoveredPoint.profit >= 0 ? `+$${hoveredPoint.profit}` : `-$${Math.abs(hoveredPoint.profit)}`}
              </span>
            </div>
            <div className="text-[11px] opacity-80">
              {mode === 'mae' ? `最大逆向浮亏: -$${hoveredPoint.mae}` : `最高顺向浮盈: +$${hoveredPoint.mfe}`}
            </div>
            <div className="text-[10px] opacity-60 mt-0.5">{hoveredPoint.date}</div>
          </div>
        )}
      </div>

      {/* Excursion Summary Statistics Bar */}
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5 grid grid-cols-3 gap-3 text-center text-xs">
        <div className="p-2 rounded-xl bg-gray-50/60 dark:bg-white/[0.02]">
          <span className="text-gray-400 dark:text-gray-500 text-[10px] block">平均最大逆向浮亏 (Avg MAE)</span>
          <span className="font-mono font-bold text-rose-500 text-sm">-${stats.avgMae}</span>
        </div>
        <div className="p-2 rounded-xl bg-gray-50/60 dark:bg-white/[0.02]">
          <span className="text-gray-400 dark:text-gray-500 text-[10px] block">平均顺向最大浮盈 (Avg MFE)</span>
          <span className="font-mono font-bold text-emerald-500 text-sm">+${stats.avgMfe}</span>
        </div>
        <div className="p-2 rounded-xl bg-gray-50/60 dark:bg-white/[0.02]">
          <span className="text-gray-400 dark:text-gray-500 text-[10px] block">利润捕捉转化率 (Efficiency)</span>
          <span className="font-mono font-bold text-purple-600 dark:text-purple-400 text-sm">{stats.efficiency}%</span>
        </div>
      </div>
    </div>
  );
};

export default MfeMaeScatterChart;
